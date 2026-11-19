import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { RowsSkeleton } from '../../components/Skeletons'
import { useSession } from './useSession'

export function RequireSession() {
  const { user, isLoading, meError, retryMe } = useSession()
  const location = useLocation()
  if (isLoading)
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 px-4 py-16">
        <p className="text-muted">Memeriksa sesi…</p>
        <RowsSkeleton rows={3} label="Memeriksa sesi" />
      </div>
    )
  if (meError)
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState error={meError} onRetry={retryMe} />
      </div>
    )
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}
