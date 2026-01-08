import axios from 'axios'

const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL || 'http://localhost:3002'

const graphqlClient = axios.create({
  baseURL: `${PAYMENT_API_URL}/graphql`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000, // 10 seconds timeout
})

graphqlClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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
      let errorMsg = 'Pastikan Payment Service berjalan di http://localhost:3002'
      
      // Check error code first
      if (error.code === 'ECONNREFUSED') {
        errorMsg = 'Tidak dapat terhubung ke Payment Service. Pastikan service berjalan di http://localhost:3002'
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMsg = 'Request timeout. Payment Service mungkin tidak merespons. Cek http://localhost:3002/health'
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMsg = 'Tidak dapat terhubung ke Payment Service. Pastikan service berjalan di http://localhost:3002'
      } else if (error.message && !error.message.includes('Network Error')) {
        // Only use error.message if it's not the generic "Network Error"
        errorMsg = `${error.message}. Pastikan Payment Service berjalan di http://localhost:3002`
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

const paymentService = {
  getAll: async (filters = {}) => {
    const query = `
      query GetPayments($status: PaymentStatus, $customerId: Int) {
        payments(status: $status, customerId: $customerId) {
          success
          message
          payments {
            id
            orderId
            customerId
            customerName
            amount
            paymentMethod
            status
            paymentDate
            notes
            createdAt
          }
          total
        }
      }
    `
    const result = await executeQuery(query, filters)
    return result.data.payments
  },

  getById: async (id) => {
    const query = `
      query GetPayment($id: ID!) {
        payment(id: $id) {
          success
          message
          payment {
            id
            orderId
            customerId
            customerName
            amount
            paymentMethod
            status
            paymentDate
            notes
            createdAt
          }
        }
      }
    `
    const result = await executeQuery(query, { id: String(id) })
    return result.data.payment
  },

  // POST /payment
  create: async (data) => {
    const query = `
      mutation CreatePayment($input: CreatePaymentInput!) {
        createPayment(input: $input) {
          success
          message
          payment {
            id
            orderId
            amount
            status
          }
        }
      }
    `
    const result = await executeQuery(query, { input: data })
    return result.data.createPayment
  },

  confirm: async (id) => {
    const query = `
      mutation ConfirmPayment($id: ID!) {
        confirmPayment(id: $id) {
          success
          message
          payment {
            id
            status
            paymentDate
          }
        }
      }
    `
    const result = await executeQuery(query, { id: String(id) })
    return result.data.confirmPayment
  },

  getStats: async () => {
    const query = `
      query GetPaymentStats {
        paymentStats {
          success
          totalPayments
          confirmedPayments
          pendingPayments
          totalRevenue
        }
      }
    `
    const result = await executeQuery(query)
    return result.data.paymentStats
  }
}

export default paymentService



