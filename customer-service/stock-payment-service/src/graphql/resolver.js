const TransactionService = require("../services/TransactionService");

const resolvers = {
    Query: {
        // Get all transactions
        transactions: async () => {
            try {
                return await TransactionService.getTransactions(50, 0);
            } catch (error) {
                throw new Error(`Failed to fetch transactions: ${error.message}`);
            }
        },

        // Get transaction by ID
        transaction: async (_, { transaction_id }) => {
            try {
                return await TransactionService.getTransactionById(transaction_id);
            } catch (error) {
                throw new Error(`Failed to fetch transaction: ${error.message}`);
            }
        },

        // Get statistics
        statistics: async () => {
            try {
                return await TransactionService.getStatistics();
            } catch (error) {
                throw new Error(`Failed to fetch statistics: ${error.message}`);
            }
        }
    },

    Mutation: {
        // Create new transaction
        createTransaction: async (_, { input }) => {
            try {
                return await TransactionService.createTransaction(input);
            } catch (error) {
                throw new Error(`Failed to create transaction: ${error.message}`);
            }
        },

        // Confirm payment
        confirmPayment: async (_, { input }) => {
            try {
                return await TransactionService.confirmPayment(input);
            } catch (error) {
                throw new Error(`Failed to confirm payment: ${error.message}`);
            }
        }
    }
};

module.exports = resolvers;