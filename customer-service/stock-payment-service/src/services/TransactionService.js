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

        // 3. Call order service to create order
        const orderResponse = await this.callOrderService(orderData);

        // 4. Calculate total cost
        const totalCost = this.calculateTotalCost(orderData.items || [], orderData.total_amount);

        // 5. Save to fact table
        const transaction = await TransactionModel.createTransaction({
            transaction_id: transactionId,
            external_order_id: orderData.external_order_id || `EXT-${Date.now()}`,
            order_id: orderResponse.order_id,
            total_cost: totalCost,
            payment_status: 'PENDING',
            stock_before: stockCheck.current_stock,
            source_system: orderData.source_system || 'EXTERNAL_SYSTEM',
            request_payload: orderData
        });

        // 6. Log audit
        await this.logAudit(transactionId, 'ORDER_CREATED', 'SYSTEM', {
            order_id: orderResponse.order_id,
            total_cost: totalCost
        });

        console.log(`✅ Transaction created: ${transactionId}`);

        return {
            success: true,
            transaction_id: transactionId,
            order_id: orderResponse.order_id,
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

        // 2. Process payment via payment service
        const paymentResponse = await this.callPaymentService({
            transaction_id: paymentData.transaction_id,
            amount: transaction.total_cost,
            payment_method: paymentData.payment_method,
            currency: transaction.currency
        });

        if (paymentResponse.status !== 'SUCCESS') {
            throw new Error('Payment processing failed');
        }

        // 3. Update inventory (deduct stock)
        const requestPayload = typeof transaction.request_payload === 'string' 
            ? JSON.parse(transaction.request_payload) 
            : transaction.request_payload;
        
        const stockUpdate = await this.updateInventory(requestPayload.items || []);

        // 4. Update transaction record
        await TransactionModel.updateTransaction(paymentData.transaction_id, {
            payment_status: 'SUCCESS',
            payment_method: paymentData.payment_method,
            payment_id: paymentResponse.payment_id,
            payment_completed_at: new Date(),
            stock_after: stockUpdate.updated_stock,
            response_payload: {
            payment: paymentResponse,
            stock: stockUpdate
            }
        });

        // 5. Log audit
        await this.logAudit(paymentData.transaction_id, 'PAYMENT_CONFIRMED', 'SYSTEM', {
            payment_id: paymentResponse.payment_id,
            payment_method: paymentData.payment_method
        });

        console.log(`✅ Payment confirmed: ${paymentData.transaction_id}`);

        return {
            success: true,
            transaction_id: paymentData.transaction_id,
            payment_status: 'SUCCESS',
            payment_id: paymentResponse.payment_id,
            message: 'Payment confirmed and stock updated successfully'
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
     * Call Order Service
     */
    static async callOrderService(orderData) {
        try {
        const response = await axios.post(
            `${process.env.ORDER_SERVICE_URL}/api/orders`,
            orderData,
            { timeout: 5000 }
        );

        await this.logIntegrationStatus(
            null, 
            'ORDER_SERVICE', 
            'SUCCESS', 
            orderData, 
            response.data
        );

        return response.data;
        } catch (error) {
        // Explicit error handling with timeout and connection error detection
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? 'Order service connection refused - service may not be running'
            : error.code === 'ETIMEDOUT'
            ? 'Order service request timeout - service may be slow or unavailable'
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
     * Call Payment Service
     */
    static async callPaymentService(paymentData) {
        try {
        const response = await axios.post(
            `${process.env.PAYMENT_SERVICE_URL}/api/payments/process`,
            paymentData,
            { timeout: 5000 }
        );

        await this.logIntegrationStatus(
            paymentData.transaction_id, 
            'PAYMENT_SERVICE', 
            'SUCCESS', 
            paymentData, 
            response.data
        );

        return response.data;
        } catch (error) {
        // Explicit error handling with timeout and connection error detection
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? 'Payment service connection refused - service may not be running'
            : error.code === 'ETIMEDOUT'
            ? 'Payment service request timeout - service may be slow or unavailable'
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
     * Update Inventory (deduct stock)
     */
    static async updateInventory(items) {
        try {
        const response = await axios.post(
            `${process.env.INVENTORY_SERVICE_URL}/api/update-stock`,
            { items, operation: 'DEDUCT' },
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
            updated: true,
            updated_stock: response.data.stock
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
            updated: true,
            updated_stock: items.map(item => ({ 
            product_id: item.product_id, 
            new_stock: 95 - item.quantity
            }))
        };
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