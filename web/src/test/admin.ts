// Admin fixtures for the fake hub (shapes from schemas.ts).
import type { AuditEvent, LogEntry, RbacRole, RbacUser } from '../lib/api/schemas'
import { users } from './api'

export const log = (id: number, level: LogEntry['level'], slug = 'hr'): LogEntry => ({
  id,
  console: {
    id: { hr: 1, gudang: 2, produksi: 3 }[slug]!,
    slug,
    name: { hr: 'HR', gudang: 'Gudang', produksi: 'Produksi' }[slug]!,
  },
  occurred_at: `2026-11-19T0${id % 10}:00:00Z`,
  level,
  message: `Pesan log ${id}`,
  actor: null,
  raw: { id, level },
})

export const audit = (
  id: number,
  action: string,
  details: AuditEvent['details'] = null,
): AuditEvent => ({
  id,
  user: { id: 1, name: 'Rina Wulandari' },
  action,
  target_type: 'item',
  target_id: 'i-kain',
  console: { slug: 'gudang' },
  details,
  created_at: '2026-11-19T03:00:00Z',
})

export const rbacUsers: RbacUser[] = [
  {
    id: 1,
    name: 'Rina Wulandari',
    email: 'admin@example.com',
    role: { code: 'admin_it', name: 'Admin IT' },
    is_active: true,
  },
  {
    id: 2,
    name: 'Budi Santoso',
    email: 'user@example.com',
    role: { code: 'user', name: 'User' },
    is_active: true,
  },
  {
    id: 3,
    name: 'Agus Prasetyo',
    email: 'agus@example.com',
    role: { code: 'user', name: 'User' },
    is_active: false,
  },
]

export const roles = (): RbacRole[] => [
  { id: 1, code: 'admin_it', name: 'Admin IT', permissions: [...users.admin.permissions] },
  { id: 2, code: 'user', name: 'User', permissions: [...users.user.permissions] },
]
