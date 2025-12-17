const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes will be added here
// POST /update-stock
// POST /payment

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stock-payment-service' });
});

app.listen(PORT, () => {
  console.log(`Stock and Payment Update Service running on port ${PORT}`);
});

