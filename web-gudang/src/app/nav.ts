import {
  Boxes,
  ClipboardList,
  House,
  KeyRound,
  Layers,
  Package,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

export const NAV: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/', label: 'Beranda', icon: House },
  { to: '/barang', label: 'Barang', icon: Package },
  { to: '/rak', label: 'Rak', icon: Layers },
  { to: '/stok', label: 'Stok', icon: Boxes },
  { to: '/reservasi', label: 'Reservasi', icon: ClipboardList },
  { to: '/akses-area', label: 'Akses area', icon: KeyRound },
  { to: '/log', label: 'Log', icon: ScrollText },
]
