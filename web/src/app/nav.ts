import {
  Boxes,
  ClipboardList,
  Factory,
  House,
  LayoutDashboard,
  LayoutList,
  Route,
  ScrollText,
  Server,
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
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
  { to: '/barang', label: 'Barang', icon: Boxes, perm: 'barang.view' },
  { to: '/produksi', label: 'Produksi', icon: Factory, perm: 'produksi.view' },
  { to: '/personel', label: 'Personel', icon: UsersRound, perm: 'personel.view' },
  { to: '/lacak', label: 'Lacak barang', icon: Route, perm: 'lacak.view' },
]

export const ADMIN_NAV: NavItem[] = [
  { to: '/', label: 'Ringkasan', icon: LayoutList, perm: 'admin.dashboard.view' },
  { to: '/console', label: 'Sumber data', icon: Server, perm: 'admin.consoles.view' },
  { to: '/log', label: 'Log gabungan', icon: ScrollText, perm: 'admin.logs.view' },
  { to: '/rbac', label: 'Pengguna & izin', icon: Users, perm: 'admin.rbac.manage' },
  { to: '/audit', label: 'Audit', icon: ClipboardList, perm: 'admin.audit.view' },
]

export const USER_HOME: Omit<NavItem, 'perm'> = { to: '/', label: 'Beranda', icon: House }

export function titleFor(pathname: string) {
  const all = [...ADMIN_NAV, ...WORK_NAV]
  if (pathname === '/') return 'Ringkasan'
  if (pathname === '/profile') return 'Profil'
  return all.find((n) => n.to !== '/' && pathname.startsWith(n.to))?.label ?? 'Console Hub'
}
