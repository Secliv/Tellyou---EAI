# Order Management Service

Microservice untuk menangani pemesanan yang dilakukan oleh toko kue dan melacak status pesanan.

## Endpoints

- `POST /order` - Membuat pesanan bahan kue dari provider
- `GET /order/{id}` - Menampilkan status pesanan dan detail lainnya

## Database

PostgreSQL dengan tabel:
- `orders` (id, customer_id, total_amount, order_date, order_status)

## GraphQL Schema

```graphql
type Order {
  id: ID!
  customerId: ID!
  totalAmount: Float!
  orderDate: String!
  orderStatus: OrderStatus!
  createdAt: String
  updatedAt: String
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

type Query {
  # Menampilkan status pesanan dan detail lainnya
  order(id: ID!): Order
  
  # Mendapatkan daftar pesanan berdasarkan customer
  orders(customerId: ID!): [Order!]!
  
  # Mendapatkan semua pesanan
  allOrders: [Order!]!
}

type Mutation {
  # Membuat pesanan bahan kue dari provider
  createOrder(
    customerId: ID!
    totalAmount: Float!
  ): Order!
  
  # Update status pesanan
  updateOrderStatus(
    id: ID!
    status: OrderStatus!
  ): Order!
}
```

## Menjalankan

```bash
npm install
npm run dev
```

