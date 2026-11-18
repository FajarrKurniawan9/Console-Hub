import { useQuery } from '@tanstack/react-query'
import { request } from '../../../lib/api/client'
import { many, rbacRole, rbacUser } from '../../../lib/api/schemas'

export const rbacKeys = {
  users: ['rbac', 'users'] as const,
  roles: ['rbac', 'roles'] as const,
}

export function useRbacUsers() {
  return useQuery({
    queryKey: rbacKeys.users,
    queryFn: () => request(many(rbacUser), { url: '/admin/rbac/users' }).then((r) => r.data),
  })
}

export function useRbacRoles() {
  return useQuery({
    queryKey: rbacKeys.roles,
    queryFn: () => request(many(rbacRole), { url: '/admin/rbac/roles' }).then((r) => r.data),
  })
}
