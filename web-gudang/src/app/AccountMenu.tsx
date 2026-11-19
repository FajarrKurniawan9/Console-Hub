import { NavLink } from 'react-router'
import { CircleUser } from 'lucide-react'

export function AccountMenu() {
  return (
    <div className="border-t p-2">
      <NavLink
        to="/akun"
        className="flex h-8 items-center gap-2 rounded-sm px-2 text-muted hover:bg-bg hover:text-fg"
      >
        <CircleUser size={16} strokeWidth={1.5} aria-hidden />
        Akun
      </NavLink>
    </div>
  )
}
