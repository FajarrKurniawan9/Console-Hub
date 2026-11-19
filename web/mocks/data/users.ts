import type { AuthUser, Permission, RbacRole, RbacUser } from '../../src/lib/api/schemas'
import { PERMISSIONS } from '../../src/lib/api/schemas'

// Mock credentials, documented in README (mock section). Removed at integration.
export const PASSWORD = 'demo12345'

// Update 2 §3.2: default User permissions.
const WORK_DEFAULT: Permission[] = [
  'barang.view',
  'barang.create',
  'barang.update',
  'produksi.view',
  'produksi.create',
  'produksi.update',
  'personel.view',
  'lacak.view',
]

// Mutable: the RBAC screen edits these, and `me` reads them on every call.
const seedRoles = (): RbacRole[] => [
  { id: 1, code: 'admin_it', name: 'Admin IT', permissions: [...PERMISSIONS] },
  { id: 2, code: 'user', name: 'User', permissions: [...WORK_DEFAULT] },
  {
    id: 3,
    code: 'user_lihat',
    name: 'User (hanya lihat)',
    permissions: WORK_DEFAULT.filter((p) => p.endsWith('.view')),
  },
]
export const roles = seedRoles()

interface MockUser {
  id: number
  name: string
  email: string
  roleId: number
  is_active: boolean
}

const seedUsers = (): MockUser[] => [
  { id: 1, name: 'Rina Wulandari', email: 'admin@example.com', roleId: 1, is_active: true },
  { id: 2, name: 'Budi Santoso', email: 'user@example.com', roleId: 2, is_active: true },
  { id: 3, name: 'Siti Rahmawati', email: 'siti@example.com', roleId: 3, is_active: true },
  { id: 4, name: 'Agus Prasetyo', email: 'agus@example.com', roleId: 2, is_active: false },
]
export const users = seedUsers()

/** Tests: undo RBAC edits. */
export function resetRbac() {
  roles.splice(0, roles.length, ...seedRoles())
  users.splice(0, users.length, ...seedUsers())
}

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
