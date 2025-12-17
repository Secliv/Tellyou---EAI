# Order Management Service

Microservice untuk menangani pemesanan yang dilakukan oleh toko kue dan melacak status pesanan.

## Endpoints

- `POST /order` - Membuat pesanan bahan kue dari provider
- `GET /order/{id}` - Menampilkan status pesanan dan detail lainnya

## Database

PostgreSQL dengan tabel:
- `orders` (id, customer_id, total_amount, order_date, order_status)

## Menjalankan

```bash
npm install
npm run dev
```

