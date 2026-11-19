import { NavLink } from 'react-router'
import { useSession } from '../features/auth/useSession'

export function AccountMenu() {
  const { user } = useSession()
  return (
    <div className="border-t p-2">
      <NavLink
        to="/akun"
        className={({ isActive }) =>
          `flex flex-col rounded-sm px-2 py-1.5 hover:bg-bg ${isActive ? 'bg-bg ring-1 ring-border' : ''}`
        }
      >
        <span className="truncate font-semibold">{user?.name}</span>
        <span className="truncate text-xs text-muted">{user?.email}</span>
      </NavLink>
    </div>
  )
}
