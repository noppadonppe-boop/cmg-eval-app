import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ManualPage from './pages/ManualPage'
import AdminPage from './pages/AdminPage'
import KpiPage from './pages/KpiPage'
import EvalPage from './pages/EvalPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/manual" element={<ManualPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/kpi" element={<KpiPage />} />
        <Route path="/eval" element={<EvalPage />} />
      </Routes>
    </Layout>
  )
}

export default App
