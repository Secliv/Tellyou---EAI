# Stock and Payment Update Service

Microservice untuk mengupdate stok bahan kue di toko setelah pesanan diterima dan memproses pembayaran.

## Endpoints

- `POST /update-stock` - Mengupdate stok bahan kue setelah menerima pasokan dari provider
- `POST /payment` - Memproses pembayaran setelah bahan kue diterima oleh toko

## Database

PostgreSQL dengan tabel:
- `payments` (id, order_id, amount, payment_status, payment_date)
- `stock_updates` (id, ingredient_id, quantity, update_date)

## Menjalankan

```bash
npm install
npm run dev
```

