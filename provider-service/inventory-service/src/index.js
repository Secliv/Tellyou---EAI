const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes will be added here
// GET /inventories
// POST /order
// POST /update-stock

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

app.listen(PORT, () => {
  console.log(`Inventory Management Service running on port ${PORT}`);
});

