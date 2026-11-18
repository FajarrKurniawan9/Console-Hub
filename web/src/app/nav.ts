import {
  Activity,
  Database,
  FileText,
  LayoutList,
  ScrollText,
  Server,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  admin?: boolean
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Ringkasan', icon: LayoutList },
  { to: '/logs', label: 'Log', icon: ScrollText },
  { to: '/data', label: 'Data console', icon: Database },
  { to: '/processes', label: 'Proses', icon: Workflow },
  { to: '/runs', label: 'Eksekusi', icon: Activity },
  { to: '/audit', label: 'Audit', icon: ShieldCheck, admin: true },
  { to: '/consoles', label: 'Console', icon: Server },
]

export const FALLBACK_ICON = FileText

export function titleFor(pathname: string) {
  if (pathname === '/') return 'Ringkasan'
  const item = NAV.find((n) => n.to !== '/' && pathname.startsWith(n.to))
  return item?.label ?? 'Console Hub'
}
