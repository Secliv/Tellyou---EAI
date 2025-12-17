# TELLYOU EAI Project

Sistem manajemen bahan kue dengan arsitektur microservices yang terdiri dari 2 container besar: Provider-Service dan Customer-Service.

## Arsitektur Sistem

### Provider-Service (Container Besar)
1. **User Service** - Menangani data pengguna (autentikasi, autorisasi, dan manajemen profil)
2. **Ingredient Management Service** - Mengelola bahan kue, memperbarui stok, dan menangani pesanan
3. **Payment Processing Service** - Memproses pembayaran dari toko kue

### Customer-Service (Container Besar)
1. **Order Management Service** - Menangani pemesanan dan melacak status pesanan
2. **Stock and Payment Update Service** - Mengupdate stok dan memproses pembayaran

## Prinsip Database

Setiap microservice memiliki database terpisah (1 layanan 1 database) untuk isolasi data dan mengurangi ketergantungan antar layanan.

## Struktur Project

```
/project-root
├── /provider-service
│   ├── /user-service
│   ├── /ingredient-service
│   └── /payment-service
├── /customer-service
│   ├── /order-service
│   └── /stock-payment-service
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Docker Desktop untuk macOS (atau Docker Engine + Docker Compose)
- Node.js 18+ (untuk development lokal)

### Install Docker Desktop

1. Download Docker Desktop dari: https://www.docker.com/products/docker-desktop/
2. Install dan jalankan Docker Desktop
3. Verifikasi instalasi:
   ```bash
   docker --version
   docker compose version
   ```

## Menjalankan Project

### Menggunakan Docker Compose (versi baru)
```bash
docker compose up -d
```

### Atau menggunakan docker-compose (versi lama)
```bash
docker-compose up -d
```

> **Catatan Penting**: Flag `-d` (detached mode) membuat containers berjalan di background. 
> - ✅ **Containers TIDAK akan mati** saat terminal ditutup
> - ✅ **Containers akan terus berjalan** sampai Docker Desktop dihentikan atau containers dihentikan manual
> - ✅ **Containers akan otomatis start** saat Docker Desktop dijalankan (jika sudah pernah di-start sebelumnya)
> - ⚠️ Containers akan mati jika: Docker Desktop dihentikan, system shutdown/restart, atau dihentikan manual

### Melihat status containers
```bash
docker compose ps
```

### Melihat logs
```bash
# Logs semua services
docker compose logs -f

# Logs service tertentu
docker compose logs -f user-service
```

### Menghentikan services
```bash
# Menghentikan containers (tapi tidak menghapus)
docker compose stop

# Menghentikan dan menghapus containers
docker compose down
```

### Menghentikan dan menghapus volumes (data akan hilang!)
```bash
docker compose down -v
```

### Restart services
```bash
docker compose restart
```

## Endpoints

### User Service
- GET /users - Mendapatkan daftar pengguna
- GET /users/{id} - Mendapatkan detail pengguna
- POST /users - Membuat pengguna baru
- PUT /users/{id} - Memperbarui data pengguna
- DELETE /users/{id} - Menghapus pengguna
- POST /auth/login - Login pengguna
- POST /auth/register - Registrasi pengguna baru

### Ingredient Management Service
- GET /ingredients - Mendapatkan daftar bahan kue
- POST /order - Membuat pesanan bahan kue
- POST /update-stock - Memperbarui stok bahan kue

### Payment Processing Service
- POST /payment - Mengonfirmasi pembayaran
- GET /payment-status - Memeriksa status pembayaran

### Order Management Service
- POST /order - Membuat pesanan bahan kue dari provider
- GET /order/{id} - Menampilkan status pesanan

### Stock and Payment Update Service
- POST /update-stock - Mengupdate stok bahan kue
- POST /payment - Memproses pembayaran

