import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import userService from '../services/userService'
import './Dashboard.css'

function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalUsers: 0,
    loading: true,
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await userService.getAllUsers()
        setStats({
          totalUsers: data.data?.length || 0,
          loading: false,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
        setStats({ ...stats, loading: false })
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="welcome-section">
        <h2>Welcome, {user?.username}!</h2>
        <p>Email: {user?.email}</p>
        <p>Role: {user?.role}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p className="stat-value">{stats.loading ? '...' : stats.totalUsers}</p>
        </div>
        <div className="stat-card">
          <h3>Inventory Items</h3>
          <p className="stat-value">-</p>
        </div>
        <div className="stat-card">
          <h3>Orders</h3>
          <p className="stat-value">-</p>
        </div>
        <div className="stat-card">
          <h3>Payments</h3>
          <p className="stat-value">-</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

