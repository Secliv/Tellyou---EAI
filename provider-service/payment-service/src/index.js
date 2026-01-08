const express = require('express');
const cors = require('cors');
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

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

// Start listening immediately (before Apollo Server initialization)
const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Payment Processing Service running on port ${PORT}`);
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

  // Apply GraphQL middleware with CORS
  app.use('/graphql',
    cors(corsOptions),
    express.json(),
    expressMiddleware(apolloServer)
  );

  // REST endpoints
  const Payment = require('./models/Payment');

  // POST /payment
  app.post('/payment', async (req, res) => {
    try {
      // Check if ANY payment already exists for this order (check all payments, not just one)
      const existingPayments = await Payment.findAllByOrderId(req.body.orderId);
      
      if (existingPayments && existingPayments.length > 0) {
        // Check if any payment is already confirmed
        const confirmedPayment = existingPayments.find(p => p.status === 'confirmed');
        if (confirmedPayment) {
          return res.status(400).json({
            success: false,
            message: `Pembayaran untuk Order #${req.body.orderId} sudah dikonfirmasi. Tidak dapat membuat pembayaran baru untuk order yang sama.`
          });
        }
        
        // Check if there's any pending payment
        const pendingPayment = existingPayments.find(p => p.status === 'pending');
        if (pendingPayment) {
          return res.status(400).json({
            success: false,
            message: `Pembayaran untuk Order #${req.body.orderId} sudah ada dengan status "Menunggu Konfirmasi". Silakan tunggu konfirmasi admin atau hubungi customer service.`
          });
        }
        
        // If payment exists with other status, still prevent duplicate
        return res.status(400).json({
          success: false,
          message: `Pembayaran untuk Order #${req.body.orderId} sudah ada. Tidak dapat membuat pembayaran baru untuk order yang sama.`
        });
      }
      
      const payment = await Payment.create(req.body);
      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // GET /payment-status
  app.get('/payment-status', async (req, res) => {
    try {
      const { id, orderId } = req.query;
      let payment;
      
      if (id) {
        payment = await Payment.findById(id);
      } else if (orderId) {
        payment = await Payment.findByOrderId(orderId);
      }
      
      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }
      
      res.json({ success: true, data: payment });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      console.error('Database connection error:', err);
    } else {
      console.log('Database connected at:', result.rows[0].now);
    }
  });
}

startServer().catch(console.error);
