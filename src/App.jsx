import { useEffect, useState } from 'react'
import Login from './pages/Login'
import EmployeeDashboard from './pages/EmployeeDashboard'
import AdminDashboard from './pages/AdminDashboard'

const STORAGE_KEY = 'nexloads_hub_session'

export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  function handleLogin(data) {
    const sessionUser = {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      role: data.role,
      position: data.position,
      department: data.department,
      manager_id: data.manager_id,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser))
    setUser(sessionUser)
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  if (!user) return <Login onLogin={handleLogin} />

  if (user.role === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} />
  }

  return <EmployeeDashboard user={user} onLogout={handleLogout} />
}
