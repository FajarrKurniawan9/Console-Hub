import clsx from 'clsx'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useCan } from '../lib/permissions'
import { GlobalDownBar } from './GlobalDownBar'
import { ADMIN_NAV, titleFor, WORK_NAV, type NavItem } from './nav'
import { OfflineBar } from './OfflineBar'
import { SkipLink } from './SkipLink'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="hidden px-2 pt-3 pb-1 text-xs text-muted md:block">{label}</span>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          className={({ isActive }) =>
            clsx(
              'flex h-8 items-center gap-2 rounded-sm px-2 text-dense transition-colors duration-150',
              isActive
                ? 'bg-bg font-semibold text-fg shadow-[inset_2px_0_0_var(--accent)]'
                : 'text-muted hover:bg-bg hover:text-fg',
            )
          }
        >
          <Icon size={16} strokeWidth={1.5} aria-hidden className="shrink-0" />
          <span className="sr-only md:not-sr-only">{label}</span>
        </NavLink>
      ))}
    </div>
  )
}

/** Admin IT shell: dense sidebar, technical banners. */
export function AdminLayout() {
  const can = useCan()
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-dvh">
      <SkipLink />
      <nav
        aria-label="Navigasi utama"
        className="sticky top-0 flex h-dvh w-14 shrink-0 flex-col overflow-y-auto border-r bg-surface p-2 md:w-52"
      >
        <div className="flex h-10 items-center px-2 text-dense font-semibold">
          <span className="hidden md:inline">Console Hub</span>
          <span className="md:hidden" aria-hidden>
            CH
          </span>
        </div>
        <NavGroup label="Admin" items={ADMIN_NAV.filter((n) => can(n.perm))} />
        <NavGroup label="Data kerja" items={WORK_NAV.filter((n) => can(n.perm))} />
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-bg">
          <div className="flex h-12 items-center gap-2 px-4 md:px-6">
            <span className="truncate text-sm font-semibold" aria-hidden>
              {titleFor(pathname)}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
          <OfflineBar />
          {can('admin.consoles.view') ? <GlobalDownBar /> : null}
        </header>
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
