import { Navigate, Outlet, useLocation } from 'react-router'
import { RowsSkeleton } from '../components/Skeletons'
import { useAuth } from '../features/auth/auth'
import { ForbiddenPage } from './StatusPages'

export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <RowsSkeleton rows={3} label="Memeriksa sesi" />
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export function RequireAdmin() {
  const { user } = useAuth()
  return user?.is_admin ? <Outlet /> : <ForbiddenPage />
}
