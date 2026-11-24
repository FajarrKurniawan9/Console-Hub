import clsx from 'clsx'
import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useCan } from '../lib/permissions'
import { USER_HOME, WORK_NAV } from './nav'
import { OfflineBar } from './OfflineBar'
import { ServiceTroubleBar } from './ServiceTroubleBar'
import { SkipLink } from './SkipLink'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { ExportQueueNavButton } from '../features/reports/ExportQueueNavButton'

/** User shell: roomy, top navigation, no technical banners. Sizes come from data-shell="user". */
export function UserLayout() {
  const can = useCan()
  const items = [USER_HOME, ...WORK_NAV.filter((n) => can(n.perm))]
  // On <html> too, so dialogs and toasts rendered in portals get the User scale.
  useEffect(() => {
    document.documentElement.dataset.shell = 'user'
    return () => {
      delete document.documentElement.dataset.shell
    }
  }, [])
  return (
    <div className="flex min-h-dvh flex-col text-sm">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b bg-bg">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-3 px-4">
          <span className="font-semibold">Console Hub</span>
          <div className="ml-auto flex items-center gap-1">
            <ExportQueueNavButton />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        <nav aria-label="Navigasi utama" className="mx-auto w-full max-w-4xl overflow-x-auto px-2">
          <ul className="flex gap-1">
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex h-control items-center gap-2 border-b-2 px-3 whitespace-nowrap transition-colors duration-150',
                      isActive
                        ? 'border-accent font-semibold text-fg'
                        : 'border-transparent text-muted hover:text-fg',
                    )
                  }
                >
                  <Icon size={16} strokeWidth={1.5} aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <OfflineBar />
        <ServiceTroubleBar />
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
