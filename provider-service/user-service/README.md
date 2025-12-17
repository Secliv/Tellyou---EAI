# User Service

Microservice untuk menangani data pengguna (autentikasi, autorisasi, dan manajemen profil pengguna).

## Endpoints

- `GET /users` - Mendapatkan daftar pengguna
- `GET /users/{id}` - Mendapatkan detail pengguna berdasarkan ID
- `POST /users` - Membuat pengguna baru
- `PUT /users/{id}` - Memperbarui data pengguna
- `DELETE /users/{id}` - Menghapus pengguna
- `POST /auth/login` - Login pengguna
- `POST /auth/register` - Registrasi pengguna baru

## Database

PostgreSQL dengan tabel:
- `users` (id, username, email, password_hash, role, created_at, updated_at)
- `user_profiles` (id, user_id, full_name, phone, address, created_at, updated_at)

## Menjalankan

```bash
npm install
npm run dev
```

