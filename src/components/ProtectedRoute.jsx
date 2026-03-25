import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader } from 'lucide-react'

/**
 * ProtectedRoute — wraps children/outlet with auth + role guards.
 * Guard order: loading → no firebase user → pending → rejected → role check
 */
export default function ProtectedRoute({ requireRoles = null, children }) {
  const { firebaseUser, userProfile, authLoading, hasConfig } = useAuth()
  const location = useLocation()

  // If Firebase is not configured, skip auth entirely
  if (!hasConfig) return children ?? <Outlet />

  // Loading state
  if (authLoading || (firebaseUser && !userProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader size={28} className="animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Pending approval
  if (userProfile?.status === 'pending') {
    return <Navigate to="/pending" replace />
  }

  // Rejected
  if (userProfile?.status === 'rejected') {
    return <Navigate to="/login" replace />
  }

  // Role check
  if (requireRoles && requireRoles.length > 0) {
    const userRoles = userProfile?.roles || ['Staff']
    const hasRole = requireRoles.some((r) => userRoles.includes(r))
    if (!hasRole) return <Navigate to="/" replace />
  }

  return children ?? <Outlet />
}
