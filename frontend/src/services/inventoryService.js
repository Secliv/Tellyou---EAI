import api from './api'

const INVENTORY_API_URL = import.meta.env.VITE_INVENTORY_API_URL || 'http://localhost:3001'

const inventoryService = {
  async getAllInventories() {
    const response = await api.get(`${INVENTORY_API_URL}/inventories`)
    return response.data
  },

  async getInventoryById(id) {
    const response = await api.get(`${INVENTORY_API_URL}/inventories/${id}`)
    return response.data
  },
}

export default inventoryService

