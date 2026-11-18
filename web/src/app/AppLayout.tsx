import clsx from 'clsx'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../features/auth/auth'
import { GlobalDownBar } from './GlobalDownBar'
import { NAV, titleFor } from './nav'
import { OfflineBar } from './OfflineBar'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export function AppLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const items = NAV.filter((n) => !n.admin || user?.is_admin)
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-bg focus:px-3 focus:py-2"
      >
        Lewati ke konten
      </a>
      <nav
        aria-label="Navigasi utama"
        className="sticky top-0 flex h-dvh w-14 shrink-0 flex-col gap-1 border-r bg-surface p-2 md:w-52"
      >
        <div className="flex h-10 items-center px-2 text-dense font-semibold">
          <span className="hidden md:inline">Console Hub</span>
          <span className="md:hidden" aria-hidden>
            CH
          </span>
        </div>
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
          <GlobalDownBar />
        </header>
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
