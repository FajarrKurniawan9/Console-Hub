import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '../../../lib/api/client'
import { many, one, rbacRole, rbacUser } from '../../../lib/api/schemas'
import { useAuth } from '../../auth/auth'

export const rbacKeys = {
  users: ['rbac', 'users'] as const,
  roles: ['rbac', 'roles'] as const,
  permissions: ['rbac', 'permissions'] as const,
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

export function usePermissionList() {
  return useQuery({
    queryKey: rbacKeys.permissions,
    queryFn: () =>
      request(many(z.string()), { url: '/admin/rbac/permissions' }).then((r) => r.data),
    staleTime: Infinity,
  })
}

const createdUser = rbacUser.extend({ initial_password: z.string().optional() })

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; role_code: string }) =>
      request(one(createdUser), { url: '/admin/rbac/users', method: 'POST', data }).then(
        (r) => r.data,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: rbacKeys.users }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  const { reloadMe, user } = useAuth()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; role_code?: string; is_active?: boolean }) =>
      request(one(rbacUser), { url: `/admin/rbac/users/${id}`, method: 'PATCH', data }).then(
        (r) => r.data,
      ),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: rbacKeys.users })
      if (u.id === user?.id) void reloadMe()
    },
  })
}

/** Saves a role's permissions, then reloads `me` so menus and buttons follow (brief 8.6). */
export function useSaveRolePermissions() {
  const qc = useQueryClient()
  const { reloadMe, user } = useAuth()
  return useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: string[] }) =>
      request(one(rbacRole), {
        url: `/admin/rbac/roles/${id}/permissions`,
        method: 'PUT',
        data: { permissions },
      }).then((r) => r.data),
    onSuccess: (role) => {
      void qc.invalidateQueries({ queryKey: rbacKeys.roles })
      if (role.code === user?.role.code) void reloadMe()
    },
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; code: string; permissions?: string[] }) =>
      request(one(rbacRole), {
        url: '/admin/rbac/roles',
        method: 'POST',
        data,
      }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rbacKeys.roles })
    },
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      request(z.unknown(), {
        url: `/admin/rbac/roles/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rbacKeys.roles })
    },
  })
}
