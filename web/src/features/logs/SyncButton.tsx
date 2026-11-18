import { ChevronDown, Download } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '../../components/ui/Button'
import { menuContent, menuItem } from '../../components/ui/menu'
import { Spinner } from '../../components/ui/Spinner'
import type { HubConsole } from '../../lib/schemas'

export function SyncButton({
  consoles,
  pending,
  onSync,
}: {
  consoles: HubConsole[]
  pending: boolean
  onSync: (consoleId: number | null) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={pending}>
        <Button>
          {pending ? <Spinner /> : <Download size={16} strokeWidth={1.5} aria-hidden />}
          {pending ? 'Menarik…' : 'Tarik sekarang'}
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={menuContent}>
          <DropdownMenu.Item className={menuItem} onSelect={() => onSync(null)}>
            Semua console
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {consoles.map((c) => (
            <DropdownMenu.Item key={c.id} className={menuItem} onSelect={() => onSync(c.id)}>
              {c.name}
              {c.status === 'down' ? (
                <span className="ml-auto text-xs text-error">mati</span>
              ) : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
