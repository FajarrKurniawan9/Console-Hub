import { LogOut } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { menuContent, menuItem } from '../components/ui/menu'
import { useAuth } from '../features/auth/auth'

export function UserMenu() {
  const { user, logout } = useAuth()
  if (!user) return null

  // Tampilkan username dari email (misal: 'nabilkencana20@gmail.com' -> 'nabilkencana20')
  // sehingga tidak duplikat dengan nama peran
  const emailPart = user.email && user.email.includes('@') ? user.email.split('@')[0] : null
  const username = emailPart || user.name || 'User'

  const initials = username.includes(' ')
    ? username
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : username.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Menu pengguna: ${username}`}
        className="inline-flex h-control items-center gap-2 rounded-sm px-1.5 text-dense hover:bg-surface"
      >
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-full border text-xs font-semibold"
        >
          {initials}
        </span>
        <span className="hidden sm:inline">{username}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={menuContent}>
          <div className="flex flex-col px-2 py-1.5">
            <span className="font-semibold">{username}</span>
            <span className="text-xs text-muted">{user.email}</span>
            <span className="text-xs text-muted">{user.role.name}</span>
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
