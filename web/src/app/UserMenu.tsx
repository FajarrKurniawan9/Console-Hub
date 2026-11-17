import { LogOut } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { menuContent, menuItem } from '../components/ui/menu'
import { useAuth } from '../features/auth/auth'

export function UserMenu() {
  const { user, logout } = useAuth()
  if (!user) return null
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Menu pengguna: ${user.name}`}
        className="inline-flex h-8 items-center gap-2 rounded-sm px-1.5 text-dense hover:bg-surface"
      >
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-full border text-xs font-semibold"
        >
          {initials}
        </span>
        <span className="hidden sm:inline">{user.name}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={menuContent}>
          <div className="flex flex-col px-2 py-1.5">
            <span className="font-semibold">{user.name}</span>
            <span className="text-xs text-muted">{user.email}</span>
            <span className="text-xs text-muted">{user.is_admin ? 'Admin' : 'Operator'}</span>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className={menuItem} onSelect={() => void logout()}>
            <LogOut size={16} strokeWidth={1.5} aria-hidden />
            Keluar
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
