const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes will be added here
// GET /users - Mendapatkan daftar pengguna
// GET /users/{id} - Mendapatkan detail pengguna
// POST /users - Membuat pengguna baru
// PUT /users/{id} - Memperbarui data pengguna
// DELETE /users/{id} - Menghapus pengguna

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});

