const Inventory = require('../models/Inventory');

const resolvers = {
  Query: {
    // GET /inventories
    inventories: async (_, { category, search }) => {
      try {
        const filters = {};
        if (category) filters.category = category;
        if (search) filters.search = search;
        
        const items = await Inventory.findAll(filters);
        
        return {
          success: true,
          message: 'Inventory items retrieved successfully',
          items,
          total: items.length
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          items: [],
          total: 0
        };
      }
    },

    inventory: async (_, { id }) => {
      try {
        const item = await Inventory.findById(id);
        
        if (!item) {
          return {
            success: false,
            message: `Inventory item with ID ${id} not found`,
            item: null
          };
        }
        
        return {
          success: true,
          message: 'Inventory item retrieved successfully',
          item
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          item: null
        };
      }
    },

    inventoryStats: async () => {
      try {
        const items = await Inventory.findAll();
        const lowStock = await Inventory.getLowStock();
        
        const totalValue = items.reduce((sum, item) => {
          return sum + (item.quantity * item.price);
        }, 0);
        
        return {
          success: true,
          totalItems: items.length,
          lowStockItems: lowStock.length,
          totalValue
        };
      } catch (error) {
        return {
          success: false,
          totalItems: 0,
          lowStockItems: 0,
          totalValue: 0
        };
      }
    },

    lowStockItems: async () => {
      try {
        const items = await Inventory.getLowStock();
        
        return {
          success: true,
          message: 'Low stock items retrieved',
          items,
          total: items.length
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          items: [],
          total: 0
        };
      }
    }
  },

  Mutation: {
    createInventory: async (_, { input }) => {
      try {
        const item = await Inventory.create(input);
        
        return {
          success: true,
          message: 'Inventory item created successfully',
          item
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          item: null
        };
      }
    },

    updateInventory: async (_, { id, input }) => {
      try {
        const existing = await Inventory.findById(id);
        
        if (!existing) {
          return {
            success: false,
            message: `Inventory item with ID ${id} not found`,
            item: null
          };
        }
        
        const item = await Inventory.update(id, input);
        
        return {
          success: true,
          message: 'Inventory item updated successfully',
          item
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          item: null
        };
      }
    },

    // POST /update-stock
    updateStock: async (_, { input }) => {
      try {
        const { id, quantityChange } = input;
        
        const existing = await Inventory.findById(id);
        
        if (!existing) {
          return {
            success: false,
            message: `Inventory item with ID ${id} not found`,
            item: null
          };
        }
        
        // Check if stock would go negative
        if (existing.quantity + quantityChange < 0) {
          return {
            success: false,
            message: `Insufficient stock. Current: ${existing.quantity}, Requested change: ${quantityChange}`,
            item: null
          };
        }
        
        const item = await Inventory.updateStock(id, quantityChange);
        
        return {
          success: true,
          message: `Stock updated. New quantity: ${item.quantity}`,
          item
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          item: null
        };
      }
    },

    deleteInventory: async (_, { id }) => {
      try {
        const existing = await Inventory.findById(id);
        
        if (!existing) {
          return {
            success: false,
            message: `Inventory item with ID ${id} not found`,
            item: null
          };
        }
        
        await Inventory.delete(id);
        
        return {
          success: true,
          message: 'Inventory item deleted successfully',
          item: existing
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          item: null
        };
      }
    }
  }
};

module.exports = resolvers;



