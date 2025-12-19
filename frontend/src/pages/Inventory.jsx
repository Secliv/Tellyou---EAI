import { useState, useEffect } from 'react'
import inventoryService from '../services/inventoryService'
import './Inventory.css'

function Inventory() {
  const [inventories, setInventories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchInventories()
  }, [])

  const fetchInventories = async () => {
    try {
      setLoading(true)
      // Note: This will work once inventory service is implemented
      // const data = await inventoryService.getAllInventories()
      // setInventories(data.data || [])
      setError('Inventory service not yet implemented')
    } catch (err) {
      setError('Failed to fetch inventories')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inventory">
      <div className="inventory-header">
        <h1>Inventory Management</h1>
        <button className="btn-primary">Add New Item</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading inventories...</div>
      ) : (
        <div className="inventory-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventories.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    No inventory items found
                  </td>
                </tr>
              ) : (
                inventories.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.stock}</td>
                    <td>${item.price}</td>
                    <td>
                      <button className="btn-edit">Edit</button>
                      <button className="btn-delete">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Inventory


