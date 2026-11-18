import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { RowsSkeleton } from '../components/Skeletons'
import { useAuth } from '../features/auth/auth'
import type { Permission } from '../lib/api/schemas'
import { hasPermission } from '../lib/permissions'
import { ForbiddenPage } from './StatusPages'

export function RequireAuth() {
  const { user, isLoading, meError, retryMe } = useAuth()
  const location = useLocation()
  if (isLoading)
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-16">
        <p className="text-dense text-muted">Memeriksa sesi…</p>
        <RowsSkeleton rows={3} label="Memeriksa sesi" />
      </div>
    )
  // Network or server trouble while loading the session: say so, don't log the user out.
  if (meError)
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-16">
        <ErrorState error={meError} onRetry={retryMe} />
      </div>
    )
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Route-level permission check; a direct URL without the permission shows 403. */
export function RequirePermission({ perm }: { perm: Permission }) {
  const { user } = useAuth()
  return hasPermission(user, perm) ? <Outlet /> : <ForbiddenPage />
}
