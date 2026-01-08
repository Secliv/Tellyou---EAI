const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginLandingPageLocalDefault } = require('@apollo/server/plugin/landingPage/default');
require('dotenv').config();

const pool = require('./config/database');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - use cors package with explicit origin array
const corsOptions = {
  origin: ['http://localhost:3005', 'http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:3005', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// Start listening immediately (before Apollo Server initialization)
const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Order Management Service running on port ${PORT}`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  console.log(`REST endpoints:`);
  console.log(`  - POST /order`);
  console.log(`  - GET /order/:id`);
  console.log(`  - GET /orders`);
  console.log(`  - PUT /order/:id/status`);
});

// Initialize Apollo Server
async function startServer() {
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true, // Enable GraphQL introspection
    plugins: [
      // Enable Apollo Sandbox landing page
      ApolloServerPluginLandingPageLocalDefault({ embed: true })
    ],
  });

  await apolloServer.start();

  // Apply GraphQL middleware with CORS
  app.use('/graphql', 
    cors(corsOptions),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        // You can add authentication context here
        const token = req.headers.authorization || '';
        return { token };
      }
    })
  );

  // REST endpoints for backward compatibility
  // POST /order - Create new order (REST wrapper)
  app.post('/order', async (req, res) => {
    try {
      const Order = require('./models/Order');
      const { customerId, customerName, items, notes, shippingAddress } = req.body;
      
      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order must contain at least one item'
        });
      }
      
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
      
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: order
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // GET /order/:id - Get order by ID (REST wrapper)
  app.get('/order/:id', async (req, res) => {
    try {
      const Order = require('./models/Order');
      const order = await Order.findById(req.params.id);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: `Order with ID ${req.params.id} not found`
        });
      }
      
      res.json({
        success: true,
        message: 'Order retrieved successfully',
        data: order
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // GET /orders - Get all orders
  app.get('/orders', async (req, res) => {
    try {
      const Order = require('./models/Order');
      const { customerId, status, limit, offset } = req.query;
      
      const filters = {};
      if (customerId) filters.customerId = parseInt(customerId);
      if (status) filters.status = status;
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);
      
      const orders = await Order.findAll(filters);
      
      res.json({
        success: true,
        message: 'Orders retrieved successfully',
        data: orders,
        total: orders.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // PUT /order/:id/status - Update order status
  app.put('/order/:id/status', async (req, res) => {
    try {
      const Order = require('./models/Order');
      const { status } = req.body;
      
      const existingOrder = await Order.findById(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: `Order with ID ${req.params.id} not found`
        });
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
                }
              }
            }
          }
        } catch (stockError) {
          console.error('❌ Error processing stock reduction:', stockError.message);
          // Continue with order status update even if stock reduction fails
        }
      }
      
      const order = await Order.updateStatus(req.params.id, status);
      
      res.json({
        success: true,
        message: `Order status updated to ${status}`,
        data: order
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error',
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });

  // Test database connection on startup
  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('Database connected successfully at:', result.rows[0].now);
    }
  });
}

startServer().catch(console.error);
