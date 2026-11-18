import clsx from 'clsx'
import { PageHeader } from '../../../components/PageHeader'
import { useUrlState } from '../../../lib/useUrlState'
import { RolesTab } from './RolesTab'
import { UsersTab } from './UsersTab'

const TABS = [
  { key: 'pengguna', label: 'Pengguna' },
  { key: 'peran', label: 'Peran dan izin' },
] as const

export function RbacPage() {
  const url = useUrlState()
  const tab = url.get('tab') === 'peran' ? 'peran' : 'pengguna'
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pengguna & izin"
        meta="Setiap pengguna punya satu peran; menu dan tombol mengikuti izin perannya."
      />
      <div role="tablist" aria-label="Bagian RBAC" className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => url.set({ tab: t.key === 'pengguna' ? null : t.key })}
            className={clsx(
              '-mb-px h-control border-b-2 px-3 text-dense',
              tab === t.key
                ? 'border-accent font-semibold text-fg'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === 'pengguna' ? <UsersTab /> : <RolesTab />}</div>
    </div>
  )
}
