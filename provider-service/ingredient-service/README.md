# Ingredient Management Service

Microservice untuk mengelola bahan kue, memperbarui stok, dan menangani pesanan dari toko kue.

## Endpoints

- `GET /ingredients` - Mendapatkan daftar bahan kue yang tersedia
- `POST /order` - Membuat pesanan bahan kue
- `POST /update-stock` - Memperbarui stok bahan kue setelah pesanan diterima

## Database

PostgreSQL dengan tabel:
- `ingredients` (id, name, stock, price, supplier_id)
- `orders` (id, ingredient_id, quantity, order_status, customer_id)

## GraphQL Schema

```graphql
type Ingredient {
  id: ID!
  name: String!
  stock: Int!
  price: Float!
  supplierId: ID!
}

type Order {
  id: ID!
  ingredientId: ID!
  ingredient: Ingredient
  quantity: Int!
  orderStatus: OrderStatus!
  customerId: ID!
  createdAt: String
}

enum OrderStatus {
  PENDING
  PROCESSING
  COMPLETED
  CANCELLED
}

type Query {
  # Mendapatkan daftar bahan kue yang tersedia
  ingredients: [Ingredient!]!
  
  # Mendapatkan detail bahan berdasarkan ID
  ingredient(id: ID!): Ingredient
  
  # Mendapatkan daftar pesanan
  orders: [Order!]!
  
  # Mendapatkan detail pesanan berdasarkan ID
  order(id: ID!): Order
}

type Mutation {
  # Membuat pesanan bahan kue
  createOrder(
    ingredientId: ID!
    quantity: Int!
    customerId: ID!
  ): Order!
  
  # Memperbarui stok bahan kue setelah pesanan diterima
  updateStock(
    ingredientId: ID!
    quantity: Int!
  ): Ingredient!
  
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

