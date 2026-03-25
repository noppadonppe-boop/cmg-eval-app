import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PendingPage from './pages/PendingPage'
import DashboardPage from './pages/DashboardPage'
import ManualPage from './pages/ManualPage'
import AdminPage from './pages/AdminPage'
import KpiPage from './pages/KpiPage'
import EvalPage from './pages/EvalPage'

function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/pending"  element={<PendingPage />} />

      {/* Protected app routes — wrapped in Layout (sidebar) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index         element={<DashboardPage />} />
          <Route path="/eval"  element={<EvalPage />} />
          <Route path="/kpi"   element={<KpiPage />} />
          <Route path="/manual" element={<ManualPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
