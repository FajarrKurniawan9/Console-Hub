import clsx from 'clsx'
import { NavLink, Outlet } from 'react-router'
import { NAV } from './nav'
import { AccountMenu } from './AccountMenu'

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-bg focus:px-3 focus:py-2"
      >
        Lewati ke konten
      </a>
      <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r bg-panel">
        <div className="flex h-14 items-center border-b px-4">
          <span className="font-semibold">Gudang</span>
        </div>
        <nav aria-label="Menu utama" className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex h-8 items-center gap-2 rounded-sm px-2',
                  isActive ? 'bg-bg font-semibold text-fg ring-1 ring-border' : 'text-muted hover:bg-bg hover:text-fg',
                )
              }
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <AccountMenu />
      </aside>
      <main id="main" className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
