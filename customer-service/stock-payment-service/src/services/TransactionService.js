const axios = require('axios');
const crypto = require('crypto');
const TransactionModel = require('../models/TransactionsModel');

// Generate unique ID helper
function generateId() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

class TransactionService {
    /**
     * Create order (Entry point untuk sistem eksternal)
     */
    static async createTransaction(orderData) {
        const transactionId = `TXN-${Date.now()}-${generateId()}`;

        try {
        console.log(`📝 Creating transaction: ${transactionId}`);

        // 1. Validate request data
        this.validateOrderData(orderData);

        // 2. Check inventory availability
        const stockCheck = await this.checkInventory(orderData.items || []);
        
        if (!stockCheck.available) {
            throw new Error('Insufficient stock for requested items');
        }

        // 3. Call order service to create order via GraphQL
        const orderResponse = await this.callOrderService(orderData);

        // 4. Calculate total cost (use order totalPrice if available, otherwise calculate)
        const totalCost = orderResponse.order?.totalPrice || 
                         this.calculateTotalCost(orderData.items || [], orderData.total_amount);

        // 5. Save to fact table
        const transaction = await TransactionModel.createTransaction({
            transaction_id: transactionId,
            external_order_id: orderData.external_order_id || `EXT-${Date.now()}`,
            order_id: String(orderResponse.order_id || orderResponse.order?.id),
            total_cost: totalCost,
            payment_status: 'PENDING',
            stock_before: stockCheck.current_stock,
            source_system: orderData.source_system || 'EXTERNAL_SYSTEM',
            request_payload: orderData
        });

        // 6. Log audit
        await this.logAudit(transactionId, 'ORDER_CREATED', 'SYSTEM', {
            order_id: orderResponse.order_id || orderResponse.order?.id,
            total_cost: totalCost,
            order_status: orderResponse.order?.status
        });

        console.log(`✅ Transaction created: ${transactionId}, Order ID: ${orderResponse.order_id || orderResponse.order?.id}`);

        return {
            success: true,
            transaction_id: transactionId,
            order_id: String(orderResponse.order_id || orderResponse.order?.id),
            total_cost: totalCost,
            payment_status: 'PENDING',
            message: 'Order created successfully. Please proceed to payment.'
        };

        } catch (error) {
        console.error(`❌ Transaction creation failed: ${error.message}`);
        
        // Log integration failure
        await this.logIntegrationStatus(
            transactionId, 
            'ORDER_SERVICE', 
            'FAILED', 
            orderData, 
            null, 
            error.message
        );
        
        throw error;
        }
    }

    /**
     * Confirm payment and update stock
     */
    static async confirmPayment(paymentData) {
        try {
        console.log(`💳 Processing payment for: ${paymentData.transaction_id}`);

        // 1. Get transaction
        const transaction = await TransactionModel.findByTransactionId(
            paymentData.transaction_id
        );

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        if (transaction.payment_status === 'SUCCESS') {
            throw new Error('Payment already processed for this transaction');
        }

        // 2. Process payment via payment service (GraphQL)
        const paymentResponse = await this.callPaymentService({
            transaction_id: paymentData.transaction_id,
            amount: transaction.total_cost,
            payment_method: paymentData.payment_method,
            currency: transaction.currency
        });

        // Payment service returns 'SUCCESS' for confirmed, 'PENDING' for pending
        if (paymentResponse.status !== 'SUCCESS' && paymentResponse.status !== 'PENDING') {
            throw new Error(`Payment processing failed: ${paymentResponse.status}`);
        }

        // 3. Update inventory (deduct stock)
        const requestPayload = typeof transaction.request_payload === 'string' 
            ? JSON.parse(transaction.request_payload) 
            : transaction.request_payload;
        
        const stockUpdate = await this.updateInventory(requestPayload.items || []);

        // 4. Update order status to 'confirmed' after payment is confirmed
        let orderStatusUpdated = false;
        if (paymentResponse.status === 'SUCCESS' && transaction.order_id) {
            try {
                await this.updateOrderStatus(transaction.order_id, 'confirmed');
                orderStatusUpdated = true;
                console.log(`✅ Order #${transaction.order_id} status updated to 'confirmed'`);
            } catch (orderStatusError) {
                console.warn(`⚠️  Failed to update order status: ${orderStatusError.message}`);
                // Continue even if order status update fails
            }
        }

        // 5. Update transaction record
        await TransactionModel.updateTransaction(paymentData.transaction_id, {
            payment_status: 'SUCCESS',
            payment_method: paymentData.payment_method,
            payment_id: paymentResponse.payment_id,
            payment_completed_at: new Date(),
            stock_after: stockUpdate.updated_stock,
            response_payload: {
            payment: paymentResponse,
            stock: stockUpdate,
            order_status_updated: orderStatusUpdated
            }
        });

        // 6. Log audit
        await this.logAudit(paymentData.transaction_id, 'PAYMENT_CONFIRMED', 'SYSTEM', {
            payment_id: paymentResponse.payment_id,
            payment_method: paymentData.payment_method,
            order_status_updated: orderStatusUpdated
        });

        console.log(`✅ Payment confirmed: ${paymentData.transaction_id}`);

        return {
            success: true,
            transaction_id: paymentData.transaction_id,
            payment_status: 'SUCCESS',
            payment_id: paymentResponse.payment_id,
            message: 'Payment confirmed, stock updated, and order status updated successfully'
        };

        } catch (error) {
        console.error(`❌ Payment confirmation failed: ${error.message}`);

        // Update transaction as failed
        await TransactionModel.updateTransaction(paymentData.transaction_id, {
            payment_status: 'FAILED',
            error_details: error.message
        });

        throw error;
        }
    }

    /**
     * Get all transactions
     */
    static async getTransactions(limit = 50, offset = 0) {
        return await TransactionModel.getAllTransactions(limit, offset);
    }

    /**
     * Get transaction by ID
     */
    static async getTransactionById(transactionId) {
        const transaction = await TransactionModel.findByTransactionId(transactionId);
        
        if (!transaction) {
        throw new Error('Transaction not found');
        }

        return transaction;
    }

    /**
     * Get transaction statistics
     */
    static async getStatistics() {
        return await TransactionModel.getStatistics();
    }

    // ============================================
    // HELPER METHODS - Integration dengan services lain
    // ============================================

    /**
     * Validate order data
     */
    static validateOrderData(data) {
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('Order must contain at least one item');
        }

        data.items.forEach((item, index) => {
        if (!item.product_id) {
            throw new Error(`Item at index ${index} missing product_id`);
        }
        if (!item.quantity || item.quantity <= 0) {
            throw new Error(`Item at index ${index} has invalid quantity`);
        }
        if (!item.price || item.price <= 0) {
            throw new Error(`Item at index ${index} has invalid price`);
        }
        });
    }

    /**
     * Check inventory availability (call Inventory Service)
     */
    static async checkInventory(items) {
        try {
        const response = await axios.post(
            `${process.env.INVENTORY_SERVICE_URL}/api/check-stock`,
            { items },
            { timeout: 5000 }
        );

        await this.logIntegrationStatus(
            null, 
            'INVENTORY_SERVICE', 
            'SUCCESS', 
            { items }, 
            response.data
        );

        return {
            available: response.data.available,
            current_stock: response.data.stock
        };
        } catch (error) {
        // Explicit error handling with timeout and connection error detection
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? 'Inventory service connection refused - service may not be running'
            : error.code === 'ETIMEDOUT'
            ? 'Inventory service request timeout - service may be slow or unavailable'
            : error.message || 'Unknown error';
        
        console.error(`❌ Inventory service error: ${errorMessage}`);
        
        // Log integration failure
        await this.logIntegrationStatus(
            null, 
            'INVENTORY_SERVICE', 
            'FAILED', 
            { items }, 
            null, 
            errorMessage
        );
        
        // In production, throw error; in development, use mock
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Inventory service unavailable: ${errorMessage}`);
        }
        
        // Mock untuk development only
        console.warn('⚠️  Using mock response for development');
        return {
            available: true,
            current_stock: items.map(item => ({ 
            product_id: item.product_id, 
            available_stock: 100,
            reserved_stock: 0
            }))
        };
        }
    }

    /**
     * Call Order Service via GraphQL
     */
    static async callOrderService(orderData) {
        try {
        // Transform orderData to match order-service GraphQL schema
        const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://order-service:3000';
        const graphqlEndpoint = `${orderServiceUrl}/graphql`;
        
        // Map items from stock-payment-service format to order-service format
        const items = (orderData.items || []).map(item => ({
            ingredientId: parseInt(item.product_id) || 0,
            name: item.name || `Product ${item.product_id}`,
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price) || 0,
            unit: item.unit || 'kg'
        }));

        const graphqlMutation = {
            query: `
                mutation CreateOrder($input: CreateOrderInput!) {
                    createOrder(input: $input) {
                        success
                        message
                        order {
                            id
                            customerId
                            customerName
                            items {
                                ingredientId
                                name
                                quantity
                                price
                                unit
                            }
                            totalPrice
                            status
                            createdAt
                        }
                    }
                }
            `,
            variables: {
                input: {
                    customerId: parseInt(orderData.customerId) || 1,
                    customerName: orderData.customerName || 'Customer',
                    items: items,
                    notes: orderData.notes || null,
                    shippingAddress: orderData.shippingAddress || null
                }
            }
        };

        const response = await axios.post(
            graphqlEndpoint,
            graphqlMutation,
            { 
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (response.data.errors) {
            throw new Error(response.data.errors[0].message || 'GraphQL error');
        }

        const result = response.data.data.createOrder;
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to create order');
        }

        await this.logIntegrationStatus(
            null, 
            'ORDER_SERVICE', 
            'SUCCESS', 
            orderData, 
            result
        );

        return {
            order_id: result.order.id,
            order: result.order,
            status: result.order.status,
            created_at: result.order.createdAt
        };
        } catch (error) {
        // Explicit error handling with timeout and connection error detection
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? 'Order service connection refused - service may not be running'
            : error.code === 'ETIMEDOUT'
            ? 'Order service request timeout - service may be slow or unavailable'
            : error.response?.data?.errors?.[0]?.message
            ? error.response.data.errors[0].message
            : error.message || 'Unknown error';
        
        console.error(`❌ Order service error: ${errorMessage}`);
        
        // Log integration failure
        await this.logIntegrationStatus(
            null, 
            'ORDER_SERVICE', 
            'FAILED', 
            orderData, 
            null, 
            errorMessage
        );
        
        // In production, throw error; in development, use mock
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Order service unavailable: ${errorMessage}`);
        }
        
        // Mock untuk development only
        console.warn('⚠️  Using mock response for development');
        return {
            order_id: `ORD-${Date.now()}`,
            status: 'CREATED',
            created_at: new Date()
        };
        }
    }

    /**
     * Call Payment Service via GraphQL
     */
    static async callPaymentService(paymentData) {
        try {
        // Get transaction to get order_id
        const transaction = await TransactionModel.findByTransactionId(paymentData.transaction_id);
        if (!transaction || !transaction.order_id) {
            throw new Error('Transaction or order_id not found');
        }

        const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3000';
        const graphqlEndpoint = `${paymentServiceUrl}/graphql`;
        
        // Map payment method from stock-payment-service format to payment-service format
        const paymentMethodMap = {
            'BANK_TRANSFER': 'transfer',
            'TRANSFER': 'transfer',
            'CASH': 'cash',
            'E_WALLET': 'e_wallet',
            'CREDIT_CARD': 'credit_card'
        };
        
        const paymentMethod = paymentMethodMap[paymentData.payment_method?.toUpperCase()] || 
                             paymentData.payment_method?.toLowerCase() || 
                             'transfer';

        const graphqlMutation = {
            query: `
                mutation CreatePayment($input: CreatePaymentInput!) {
                    createPayment(input: $input) {
                        success
                        message
                        payment {
                            id
                            orderId
                            customerId
                            customerName
                            amount
                            paymentMethod
                            status
                            createdAt
                        }
                    }
                }
            `,
            variables: {
                input: {
                    orderId: parseInt(transaction.order_id) || parseInt(transaction.external_order_id?.replace('ORD-', '')) || 0,
                    customerId: parseInt(transaction.request_payload?.customerId) || 1,
                    customerName: transaction.request_payload?.customerName || 'Customer',
                    amount: parseFloat(paymentData.amount) || parseFloat(transaction.total_cost) || 0,
                    paymentMethod: paymentMethod,
                    notes: `Transaction: ${paymentData.transaction_id}`
                }
            }
        };

        const response = await axios.post(
            graphqlEndpoint,
            graphqlMutation,
            { 
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (response.data.errors) {
            throw new Error(response.data.errors[0].message || 'GraphQL error');
        }

        const result = response.data.data.createPayment;
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to create payment');
        }

        await this.logIntegrationStatus(
            paymentData.transaction_id, 
            'PAYMENT_SERVICE', 
            'SUCCESS', 
            paymentData, 
            result
        );

        return {
            payment_id: result.payment.id,
            payment: result.payment,
            status: result.payment.status === 'confirmed' ? 'SUCCESS' : 'PENDING',
            processed_at: result.payment.createdAt
        };
        } catch (error) {
        // Explicit error handling with timeout and connection error detection
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? 'Payment service connection refused - service may not be running'
            : error.code === 'ETIMEDOUT'
            ? 'Payment service request timeout - service may be slow or unavailable'
            : error.response?.data?.errors?.[0]?.message
            ? error.response.data.errors[0].message
            : error.message || 'Unknown error';
        
        console.error(`❌ Payment service error: ${errorMessage}`);
        
        // Log integration failure
        await this.logIntegrationStatus(
            paymentData.transaction_id, 
            'PAYMENT_SERVICE', 
            'FAILED', 
            paymentData, 
            null, 
            errorMessage
        );
        
        // In production, throw error; in development, use mock
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Payment service unavailable: ${errorMessage}`);
        }
        
        // Mock untuk development only
        console.warn('⚠️  Using mock response for development');
        return {
            payment_id: `PAY-${Date.now()}`,
            status: 'SUCCESS',
            processed_at: new Date()
        };
        }
    }

    /**
     * Update Inventory (deduct stock) via GraphQL
     */
    static async updateInventory(items) {
        try {
        const inventoryServiceUrl = process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:3000';
        const graphqlEndpoint = `${inventoryServiceUrl}/graphql`;
        
        // Update stock for each item using GraphQL mutation
        const updatePromises = items.map(item => {
            const graphqlMutation = {
                query: `
                    mutation UpdateStock($input: UpdateStockInput!) {
                        updateStock(input: $input) {
                            success
                            message
                            item {
                                id
                                name
                                quantity
                                unit
                            }
                        }
                    }
                `,
                variables: {
                    input: {
                        id: String(item.product_id || item.ingredientId),
                        quantityChange: -parseInt(item.quantity) || -1 // Negative to deduct stock
                    }
                }
            };

            return axios.post(
                graphqlEndpoint,
                graphqlMutation,
                { 
                    timeout: 10000,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        });

        const responses = await Promise.all(updatePromises);
        
        // Check for errors
        const errors = responses.filter(r => r.data.errors || !r.data.data?.updateStock?.success);
        if (errors.length > 0) {
            const errorMessages = errors.map(e => 
                e.data?.errors?.[0]?.message || 
                e.data?.data?.updateStock?.message || 
                'Unknown error'
            );
            throw new Error(`Stock update failed: ${errorMessages.join(', ')}`);
        }

        const updatedItems = responses.map(r => r.data.data.updateStock.item);
        
        await this.logIntegrationStatus(
            null, 
            'INVENTORY_SERVICE', 
            'SUCCESS', 
            { items }, 
            { updatedItems }
        );

        return {
            updated: true,
            updated_stock: updatedItems
        };
        } catch (error) {
        // Explicit error handling with timeout and connection error detection
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? 'Inventory service connection refused - service may not be running'
            : error.code === 'ETIMEDOUT'
            ? 'Inventory service request timeout - service may be slow or unavailable'
            : error.response?.data?.errors?.[0]?.message
            ? error.response.data.errors[0].message
            : error.message || 'Unknown error';
        
        console.error(`❌ Inventory service error: ${errorMessage}`);
        
        // Log integration failure
        await this.logIntegrationStatus(
            null, 
            'INVENTORY_SERVICE', 
            'FAILED', 
            { items }, 
            null, 
            errorMessage
        );
        
        // In production, throw error; in development, use mock
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Inventory service unavailable: ${errorMessage}`);
        }
        
        // Mock untuk development only
        console.warn('⚠️  Using mock response for development');
        return {
            updated: true,
            updated_stock: items.map(item => ({ 
            product_id: item.product_id, 
            new_stock: 95 - item.quantity
            }))
        };
        }
    }

    /**
     * Update Order Status via GraphQL
     */
    static async updateOrderStatus(orderId, status) {
        try {
        const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://order-service:3000';
        const graphqlEndpoint = `${orderServiceUrl}/graphql`;
        
        const graphqlMutation = {
            query: `
                mutation UpdateOrderStatus($id: ID!, $status: OrderStatus!) {
                    updateOrderStatus(id: $id, status: $status) {
                        success
                        message
                        order {
                            id
                            status
                            updatedAt
                        }
                    }
                }
            `,
            variables: {
                id: String(orderId),
                status: status.toLowerCase() // Convert to lowercase to match enum
            }
        };

        const response = await axios.post(
            graphqlEndpoint,
            graphqlMutation,
            { 
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (response.data.errors) {
            throw new Error(response.data.errors[0].message || 'GraphQL error');
        }

        const result = response.data.data.updateOrderStatus;
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to update order status');
        }

        await this.logIntegrationStatus(
            null, 
            'ORDER_SERVICE', 
            'SUCCESS', 
            { orderId, status }, 
            result
        );

        return result.order;
        } catch (error) {
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? 'Order service connection refused - service may not be running'
            : error.code === 'ETIMEDOUT'
            ? 'Order service request timeout - service may be slow or unavailable'
            : error.response?.data?.errors?.[0]?.message
            ? error.response.data.errors[0].message
            : error.message || 'Unknown error';
        
        console.error(`❌ Order status update error: ${errorMessage}`);
        
        await this.logIntegrationStatus(
            null, 
            'ORDER_SERVICE', 
            'FAILED', 
            { orderId, status }, 
            null, 
            errorMessage
        );
        
        // Don't throw in development, just log warning
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Order service unavailable: ${errorMessage}`);
        }
        
        console.warn('⚠️  Order status update failed, continuing...');
        return null;
        }
    }

    /**
     * Calculate total cost
     */
    static calculateTotalCost(items, providedTotal = null) {
        if (providedTotal) return providedTotal;
        
        return items.reduce((total, item) => {
        return total + (item.price * item.quantity);
        }, 0);
    }

    /**
     * Log to audit_logs table
     */
    static async logAudit(transactionId, action, actor, details) {
        try {
        const query = `
            INSERT INTO audit_logs (transaction_id, action, actor, details)
            VALUES ($1, $2, $3, $4)
        `;
        
        await require('../config/database').query(query, [
            transactionId,
            action,
            actor,
            JSON.stringify(details)
        ]);
        } catch (error) {
        console.error('❌ Failed to log audit:', error.message);
        }
    }

    /**
     * Log to integration_status table
     */
    static async logIntegrationStatus(
        transactionId, 
        serviceName, 
        status, 
        requestData, 
        responseData, 
        errorMessage = null
    ) {
        try {
        const query = `
            INSERT INTO integration_status 
            (transaction_id, service_name, status, request_data, response_data, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        await require('../config/database').query(query, [
            transactionId,
            serviceName,
            status,
            JSON.stringify(requestData || {}),
            JSON.stringify(responseData || {}),
            errorMessage
        ]);
        } catch (error) {
        console.error('❌ Failed to log integration status:', error.message);
        }
    }
    }

module.exports = TransactionService;