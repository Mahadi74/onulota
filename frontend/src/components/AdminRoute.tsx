import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface AdminRouteProps {
  children: React.ReactNode
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, accessToken } = useAuthStore()

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
