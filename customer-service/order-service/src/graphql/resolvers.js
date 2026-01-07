const Order = require('../models/Order');const axios = require('axios');

const resolvers = {
  Query: {
    // GET /order/{id} - Get order by ID
    order: async (_, { id }) => {
      try {
        const order = await Order.findById(id);
        
        if (!order) {
          return {
            success: false,
            message: `Order with ID ${id} not found`,
            order: null
          };
        }
        
        return {
          success: true,
          message: 'Order retrieved successfully',
          order
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          order: null
        };
      }
    },

    // Get all orders with filters
    orders: async (_, { customerId, status, limit, offset }) => {
      try {
        const filters = {};
        if (customerId) filters.customerId = customerId;
        if (status) filters.status = status;
        if (limit) filters.limit = limit;
        if (offset) filters.offset = offset;
        
        const orders = await Order.findAll(filters);
        
        return {
          success: true,
          message: 'Orders retrieved successfully',
          orders,
          total: orders.length
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          orders: [],
          total: 0
        };
      }
    },

    // Get order status only
    orderStatus: async (_, { id }) => {
      try {
        const order = await Order.findById(id);
        
        if (!order) {
          return {
            success: false,
            message: `Order with ID ${id} not found`,
            order: null
          };
        }
        
        return {
          success: true,
          message: `Order status: ${order.status}`,
          order
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          order: null
        };
      }
    }
  },

  Mutation: {
    // POST /order - Create new order
    createOrder: async (_, { input }) => {
      try {
        const { customerId, customerName, items, notes, shippingAddress } = input;
        
        // Validate items
        if (!items || items.length === 0) {
          return {
            success: false,
            message: 'Order must contain at least one item',
            order: null
          };
        }
        
        // Calculate total price
        const totalPrice = items.reduce((sum, item) => {
          return sum + (item.price * item.quantity);
        }, 0);
        
        const order = await Order.create({
          customerId,
          customerName,
          items,
          totalPrice,
          notes,
          shippingAddress
        });
        
        return {
          success: true,
          message: 'Order created successfully',
          order
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          order: null
        };
      }
    },

    // Update order status
    updateOrderStatus: async (_, { id, status }) => {
      try {
        const existingOrder = await Order.findById(id);
        
        if (!existingOrder) {
          return {
            success: false,
            message: `Order with ID ${id} not found`,
            order: null
          };
        }
        
        // If status is being changed to 'shipped' or 'delivered', reduce inventory stock
        // Stock is reduced when order is shipped (Dikirim) to reflect actual inventory usage
        if ((status === 'shipped' || status === 'delivered') && 
            existingOrder.status !== 'shipped' && 
            existingOrder.status !== 'delivered') {
          try {
            // Parse items from order (items is stored as JSON string in database)
            const items = typeof existingOrder.items === 'string' 
              ? JSON.parse(existingOrder.items) 
              : existingOrder.items;
            
            if (items && Array.isArray(items) && items.length > 0) {
              // Reduce stock for each item in the order
              for (const item of items) {
                if (item.ingredientId && item.quantity) {
                  try {
                    // Call inventory service to reduce stock
                    const inventoryUrl = process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:3000';
                    const response = await axios.post(
                      `${inventoryUrl}/graphql`,
                      {
                        query: `
                          mutation UpdateStock($input: UpdateStockInput!) {
                            updateStock(input: $input) {
                              success
                              message
                              item {
                                id
                                name
                                quantity
                              }
                            }
                          }
                        `,
                        variables: {
                          input: {
                            id: String(item.ingredientId),
                            quantityChange: -parseInt(item.quantity) // Negative to reduce stock
                          }
                        }
                      },
                      {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 5000
                      }
                    );

                    if (response.data && response.data.data && response.data.data.updateStock) {
                      const result = response.data.data.updateStock;
                      if (result.success) {
                        console.log(`✅ Stock reduced for ingredient ${item.ingredientId}: ${item.quantity} ${item.unit || ''}`);
                      } else {
                        console.warn(`⚠️  Failed to reduce stock for ingredient ${item.ingredientId}: ${result.message}`);
                      }
                    }
                  } catch (inventoryError) {
                    console.error(`❌ Error reducing stock for ingredient ${item.ingredientId}:`, inventoryError.message);
                    // Continue with order status update even if inventory update fails
                    // This prevents order status update from failing due to inventory service issues
                  }
                }
              }
            }
          } catch (stockError) {
            console.error('❌ Error processing stock reduction:', stockError.message);
            // Continue with order status update even if stock reduction fails
          }
        }
        
        const order = await Order.updateStatus(id, status);
        
        return {
          success: true,
          message: `Order status updated to ${status}`,
          order
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          order: null
        };
      }
    },

    // Update order details
    updateOrder: async (_, { id, input }) => {
      try {
        const existingOrder = await Order.findById(id);
        
        if (!existingOrder) {
          return {
            success: false,
            message: `Order with ID ${id} not found`,
            order: null
          };
        }
        
        // Recalculate total if items are updated
        let updateData = { ...input };
        if (input.items && input.items.length > 0) {
          updateData.totalPrice = input.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
          }, 0);
        }
        
        const order = await Order.update(id, updateData);
        
        return {
          success: true,
          message: 'Order updated successfully',
          order
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          order: null
        };
      }
    },

    // Cancel order
    cancelOrder: async (_, { id }) => {
      try {
        const existingOrder = await Order.findById(id);
        
        if (!existingOrder) {
          return {
            success: false,
            message: `Order with ID ${id} not found`,
            order: null
          };
        }
        
        // Only allow cancellation for pending or confirmed orders
        if (!['pending', 'confirmed'].includes(existingOrder.status)) {
          return {
            success: false,
            message: `Cannot cancel order with status: ${existingOrder.status}`,
            order: null
          };
        }
        
        const order = await Order.updateStatus(id, 'cancelled');
        
        return {
          success: true,
          message: 'Order cancelled successfully',
          order
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          order: null
        };
      }
    },

    // Delete order
    deleteOrder: async (_, { id }) => {
      try {
        const existingOrder = await Order.findById(id);
        
        if (!existingOrder) {
          return {
            success: false,
            message: `Order with ID ${id} not found`,
            order: null
          };
        }
        
        await Order.delete(id);
        
        return {
          success: true,
          message: 'Order deleted successfully',
          order: existingOrder
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          order: null
        };
      }
    }
  }
};

module.exports = resolvers;




