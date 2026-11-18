import {
  Boxes,
  ClipboardList,
  FileSearch,
  House,
  LayoutList,
  Network,
  ScrollText,
  Server,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '../lib/api/schemas'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  perm: Permission
}

export const WORK_NAV: NavItem[] = [
  { to: '/pesanan', label: 'Pesanan', icon: ClipboardList, perm: 'pesanan.view' },
  { to: '/barang', label: 'Barang', icon: Boxes, perm: 'barang.view' },
  { to: '/karyawan', label: 'Karyawan', icon: UsersRound, perm: 'karyawan.view' },
  { to: '/divisi', label: 'Divisi', icon: Network, perm: 'divisi.view' },
]

export const ADMIN_NAV: NavItem[] = [
  { to: '/', label: 'Ringkasan', icon: LayoutList, perm: 'admin.dashboard.view' },
  { to: '/console', label: 'Console', icon: Server, perm: 'admin.consoles.view' },
  { to: '/log', label: 'Log gabungan', icon: ScrollText, perm: 'admin.logs.view' },
  { to: '/transaksi', label: 'Transaksi', icon: FileSearch, perm: 'admin.transactions.view' },
  { to: '/konsistensi', label: 'Konsistensi', icon: ShieldCheck, perm: 'admin.consistency.view' },
  { to: '/rbac', label: 'Pengguna & izin', icon: Users, perm: 'admin.rbac.manage' },
  { to: '/audit', label: 'Audit', icon: ScrollText, perm: 'admin.audit.view' },
]

export const USER_HOME: Omit<NavItem, 'perm'> = { to: '/', label: 'Beranda', icon: House }

export function titleFor(pathname: string) {
  const all = [...ADMIN_NAV, ...WORK_NAV]
  if (pathname === '/') return 'Ringkasan'
  return all.find((n) => n.to !== '/' && pathname.startsWith(n.to))?.label ?? 'Console Hub'
}
