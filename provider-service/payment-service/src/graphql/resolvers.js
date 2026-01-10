const Payment = require('../models/Payment');

const resolvers = {
  Query: {
    payments: async (_, { status, customerId }) => {
      try {
        const filters = {};
        if (status) filters.status = status;
        if (customerId) filters.customerId = customerId;
        
        const payments = await Payment.findAll(filters);
        
        return {
          success: true,
          message: 'Payments retrieved successfully',
          payments,
          total: payments.length
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          payments: [],
          total: 0
        };
      }
    },

    // GET /payment-status
    payment: async (_, { id }) => {
      try {
        const payment = await Payment.findById(id);
        
        if (!payment) {
          return {
            success: false,
            message: `Payment with ID ${id} not found`,
            payment: null
          };
        }
        
        return {
          success: true,
          message: 'Payment retrieved successfully',
          payment
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          payment: null
        };
      }
    },

    paymentByOrder: async (_, { orderId }) => {
      try {
        const payment = await Payment.findByOrderId(orderId);
        
        if (!payment) {
          return {
            success: false,
            message: `Payment for order ${orderId} not found`,
            payment: null
          };
        }
        
        return {
          success: true,
          message: 'Payment retrieved successfully',
          payment
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          payment: null
        };
      }
    },

    paymentStats: async () => {
      try {
        const all = await Payment.findAll();
        const confirmed = all.filter(p => p.status === 'confirmed');
        const pending = all.filter(p => p.status === 'pending');
        const totalRevenue = await Payment.getTotalRevenue();
        
        return {
          success: true,
          totalPayments: all.length,
          confirmedPayments: confirmed.length,
          pendingPayments: pending.length,
          totalRevenue
        };
      } catch (error) {
        return {
          success: false,
          totalPayments: 0,
          confirmedPayments: 0,
          pendingPayments: 0,
          totalRevenue: 0
        };
      }
    }
  },

  Mutation: {
    // POST /payment
    createPayment: async (_, { input }) => {
      try {
        // Check if ANY payment already exists for this order (check all payments, not just one)
        const existingPayments = await Payment.findAllByOrderId(input.orderId);
        
        if (existingPayments && existingPayments.length > 0) {
          // Check if any payment is already confirmed
          const confirmedPayment = existingPayments.find(p => p.status === 'confirmed');
          if (confirmedPayment) {
            return {
              success: false,
              message: `Pembayaran untuk Order #${input.orderId} sudah dikonfirmasi. Tidak dapat membuat pembayaran baru untuk order yang sama.`,
              payment: null
            };
          }
          
          // Check if there's any pending payment
          const pendingPayment = existingPayments.find(p => p.status === 'pending');
          if (pendingPayment) {
            return {
              success: false,
              message: `Pembayaran untuk Order #${input.orderId} sudah ada dengan status "Menunggu Konfirmasi". Silakan tunggu konfirmasi admin atau hubungi customer service.`,
              payment: null
            };
          }
          
          // If payment exists with other status (failed, refunded), still prevent duplicate
          return {
            success: false,
            message: `Pembayaran untuk Order #${input.orderId} sudah ada. Tidak dapat membuat pembayaran baru untuk order yang sama.`,
            payment: null
          };
        }
        
        const payment = await Payment.create(input);
        
        return {
          success: true,
          message: 'Payment created successfully',
          payment
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          payment: null
        };
      }
    },

    confirmPayment: async (_, { id }) => {
      try {
        const existing = await Payment.findById(id);
        
        if (!existing) {
          return {
            success: false,
            message: `Payment with ID ${id} not found`,
            payment: null
          };
        }
        
        if (existing.status === 'confirmed') {
          return {
            success: false,
            message: 'Payment already confirmed',
            payment: existing
          };
        }
        
        const payment = await Payment.confirmPayment(id);
        
        return {
          success: true,
          message: 'Payment confirmed successfully',
          payment
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          payment: null
        };
      }
    },

    updatePaymentStatus: async (_, { id, status }) => {
      try {
        const existing = await Payment.findById(id);
        
        if (!existing) {
          return {
            success: false,
            message: `Payment with ID ${id} not found`,
            payment: null
          };
        }
        
        const payment = await Payment.updateStatus(id, status);
        
        return {
          success: true,
          message: `Payment status updated to ${status}`,
          payment
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          payment: null
        };
      }
    }
  }
};

module.exports = resolvers;



