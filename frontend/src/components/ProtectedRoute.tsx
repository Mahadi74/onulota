import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, accessToken } = useAuthStore()

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
