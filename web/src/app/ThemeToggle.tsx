import { DropdownMenu } from 'radix-ui'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '../lib/theme'
import { menuContent, menuItem } from '../components/ui/menu'

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Ikuti sistem', icon: Monitor },
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0]!
  const Icon = current.icon
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Tema: ${current.label}`}
        className="inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-fg"
      >
        <Icon size={16} strokeWidth={1.5} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={menuContent}>
          <DropdownMenu.RadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            {OPTIONS.map(({ value, label, icon: I }) => (
              <DropdownMenu.RadioItem key={value} value={value} className={menuItem}>
                <I size={16} strokeWidth={1.5} aria-hidden />
                {label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
