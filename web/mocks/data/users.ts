import type { AuthUser, Permission, RbacRole, RbacUser } from '../../src/lib/api/schemas'
import { PERMISSIONS } from '../../src/lib/api/schemas'

// Mock credentials, documented in README (mock section). Removed at integration.
export const PASSWORD = 'demo12345'

const WORK_DEFAULT: Permission[] = [
  'karyawan.view',
  'karyawan.create',
  'karyawan.update',
  'divisi.view',
  'barang.view',
  'barang.create',
  'barang.update',
  'pesanan.view',
  'pesanan.create',
  'pesanan.complete',
  'pesanan.cancel',
]

// Mutable: the RBAC screen edits these, and `me` reads them on every call.
export const roles: RbacRole[] = [
  { id: 1, code: 'admin_it', name: 'Admin IT', permissions: [...PERMISSIONS] },
  { id: 2, code: 'user', name: 'User', permissions: [...WORK_DEFAULT] },
  {
    id: 3,
    code: 'user_lihat',
    name: 'User (tanpa buat pesanan)',
    permissions: WORK_DEFAULT.filter((p) => p !== 'pesanan.create'),
  },
]

interface MockUser {
  id: number
  name: string
  email: string
  roleId: number
  is_active: boolean
}

export const users: MockUser[] = [
  { id: 1, name: 'Rina Wulandari', email: 'admin@example.com', roleId: 1, is_active: true },
  { id: 2, name: 'Budi Santoso', email: 'user@example.com', roleId: 2, is_active: true },
  { id: 3, name: 'Siti Rahmawati', email: 'siti@example.com', roleId: 3, is_active: true },
  { id: 4, name: 'Agus Prasetyo', email: 'agus@example.com', roleId: 2, is_active: false },
]

const roleOf = (u: MockUser) => roles.find((r) => r.id === u.roleId)!

export function authView(u: MockUser): AuthUser {
  const r = roleOf(u)
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: { code: r.code, name: r.name },
    permissions: [...r.permissions],
  }
}

export function rbacView(u: MockUser): RbacUser {
  const r = roleOf(u)
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: { code: r.code, name: r.name },
    is_active: u.is_active,
  }
}

export const can = (u: MockUser, perm: Permission) => roleOf(u).permissions.includes(perm)
export type { MockUser }
