require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginLandingPageLocalDefault } = require('@apollo/server/plugin/landingPage/default');

const pool = require('./config/database');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');

const app = express();
// Use PORT from environment (docker-compose) or default to 3000
// Environment variables from docker-compose override .env file
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

// Start listening immediately (before Apollo Server initialization)
// This ensures health endpoint is available even if Apollo Server fails
const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Inventory Management Service running on port ${PORT}`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
});

async function startServer() {
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });

  await apolloServer.start();

  app.use('/graphql',
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
      credentials: true
    }),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const token = req.headers.authorization || '';
        return { token };
      }
    })
  );

  // REST endpoints for backward compatibility
  const Inventory = require('./models/Inventory');

  // GET /inventories
  app.get('/inventories', async (req, res) => {
    try {
      const { category, search } = req.query;
      const filters = {};
      if (category) filters.category = category;
      if (search) filters.search = search;
      
      const items = await Inventory.findAll(filters);
      res.json({ success: true, data: items, total: items.length });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /update-stock
  app.post('/update-stock', async (req, res) => {
    try {
      const { id, quantityChange } = req.body;
      const item = await Inventory.updateStock(id, quantityChange);
      res.json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Error handling
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('Database connected successfully at:', result.rows[0].now);
    }
  });
}

startServer().catch(console.error);
