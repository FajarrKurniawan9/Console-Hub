import type { ReactNode } from 'react'
import { useAuth } from '../features/auth/auth'
import type { AuthUser, Permission } from './api/schemas'

export function hasPermission(user: AuthUser | null, perm: Permission) {
  return !!user?.permissions.includes(perm)
}

/** Admin IT layout is chosen by this permission, not by the role code (brief 8). */
export const isAdminView = (user: AuthUser | null) => hasPermission(user, 'admin.dashboard.view')

export function useCan() {
  const { user } = useAuth()
  return (perm: Permission) => hasPermission(user, perm)
}

export function useIsAdminView() {
  return isAdminView(useAuth().user)
}

/** Renders children only when the user holds `perm`. */
export function Can({
  perm,
  children,
  fallback = null,
}: {
  perm: Permission
  children: ReactNode
  fallback?: ReactNode
}) {
  return useCan()(perm) ? children : fallback
}
