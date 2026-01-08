import axios from 'axios'

const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL || 'http://localhost:3003'

// GraphQL client for order service
const graphqlClient = axios.create({
  baseURL: `${ORDER_API_URL}/graphql`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
})

// Add token to requests
graphqlClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// GraphQL query helper
const executeQuery = async (query, variables = {}) => {
  try {
    const response = await graphqlClient.post('', { query, variables })
    
    // Check for GraphQL errors
    if (response.data.errors) {
      console.error('GraphQL errors:', response.data.errors)
      const error = new Error(response.data.errors[0]?.message || 'GraphQL error')
      error.response = { data: { errors: response.data.errors } }
      throw error
    }
    
    return response.data
  } catch (error) {
    console.error('Execute query error:', error)
    
    // Handle network errors (no response)
    if (!error.response) {
      let errorMsg = 'Pastikan Order Service berjalan di http://localhost:3003'
      
      // Check error code first
      if (error.code === 'ECONNREFUSED') {
        errorMsg = 'Tidak dapat terhubung ke Order Service. Pastikan service berjalan di http://localhost:3003'
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMsg = 'Request timeout. Order Service mungkin tidak merespons. Cek http://localhost:3003/health'
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMsg = 'Tidak dapat terhubung ke Order Service. Pastikan service berjalan di http://localhost:3003'
      } else if (error.message && !error.message.includes('Network Error')) {
        // Only use error.message if it's not the generic "Network Error"
        errorMsg = `${error.message}. Pastikan Order Service berjalan di http://localhost:3003`
      }
      
      const networkError = new Error(errorMsg)
      networkError.response = { data: { message: errorMsg } }
      networkError.isNetworkError = true
      throw networkError
    }
    
    // Handle HTTP errors
    if (error.response.status >= 400) {
      const httpError = new Error(
        error.response.data?.errors?.[0]?.message || 
        error.response.data?.message || 
        `HTTP ${error.response.status}: ${error.response.statusText}`
      )
      httpError.response = error.response
      throw httpError
    }
    
    // Re-throw other errors
    throw error
  }
}

// Order Service Functions
const orderService = {
  // Get all orders
  getAllOrders: async (filters = {}) => {
    const query = `
      query GetOrders($customerId: Int, $status: OrderStatus, $limit: Int, $offset: Int) {
        orders(customerId: $customerId, status: $status, limit: $limit, offset: $offset) {
          success
          message
          orders {
            id
            customerId
            customerName
            items {
              ingredientId
              name
              quantity
              price
              unit
            }
            totalPrice
            status
            notes
            shippingAddress
            createdAt
            updatedAt
          }
          total
        }
      }
    `
    const result = await executeQuery(query, filters)
    return result.data.orders
  },

  // Get order by ID
  getOrderById: async (id) => {
    const query = `
      query GetOrder($id: ID!) {
        order(id: $id) {
          success
          message
          order {
            id
            customerId
            customerName
            items {
              ingredientId
              name
              quantity
              price
              unit
            }
            totalPrice
            status
            notes
            shippingAddress
            createdAt
            updatedAt
          }
        }
      }
    `
    const result = await executeQuery(query, { id: String(id) })
    return result.data.order
  },

  // Create new order
  createOrder: async (orderData) => {
    const query = `
      mutation CreateOrder($input: CreateOrderInput!) {
        createOrder(input: $input) {
          success
          message
          order {
            id
            customerId
            customerName
            items {
              ingredientId
              name
              quantity
              price
              unit
            }
            totalPrice
            status
            createdAt
          }
        }
      }
    `
    const result = await executeQuery(query, { input: orderData })
    return result.data.createOrder
  },

  // Update order status
  updateOrderStatus: async (id, status) => {
    const query = `
      mutation UpdateOrderStatus($id: ID!, $status: OrderStatus!) {
        updateOrderStatus(id: $id, status: $status) {
          success
          message
          order {
            id
            status
            updatedAt
          }
        }
      }
    `
    const result = await executeQuery(query, { id: String(id), status })
    return result.data.updateOrderStatus
  },

  // Cancel order
  cancelOrder: async (id) => {
    const query = `
      mutation CancelOrder($id: ID!) {
        cancelOrder(id: $id) {
          success
          message
          order {
            id
            status
          }
        }
      }
    `
    const result = await executeQuery(query, { id: String(id) })
    return result.data.cancelOrder
  },
}

export default orderService




