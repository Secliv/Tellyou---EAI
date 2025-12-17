# Payment Processing Service

Microservice untuk memproses pembayaran dari toko kue setelah mereka melakukan pemesanan bahan kue.

## Endpoints

- `POST /payment` - Mengonfirmasi pembayaran dari toko kue
- `GET /payment-status` - Memeriksa status pembayaran

## Database

PostgreSQL dengan tabel:
- `payments` (id, order_id, amount, payment_status, payment_date)

## Menjalankan

```bash
npm install
npm run dev
```

