import { useQuery } from '@tanstack/react-query'
import { Boxes, Plus, Route, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { listOf } from '../../lib/api/work'
import { number } from '../../lib/format'
import { useCan } from '../../lib/permissions'
import { useAuth } from '../auth/auth'
import { Merged } from './Merged'
import { workKeys } from './queries'

function BigAction({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="flex h-16 items-center gap-3 rounded-md border bg-bg px-4 font-semibold transition-colors duration-150 hover:bg-surface"
    >
      <Icon size={20} strokeWidth={1.5} aria-hidden className="text-accent" />
      {label}
    </Link>
  )
}

/** User home (update 2 §4.1.1): big buttons for allowed actions, then the latest items. */
export function UserHomePage() {
  const { user } = useAuth()
  const can = useCan()
  const latest = useQuery({
    queryKey: [...workKeys.all('items'), 'home'],
    queryFn: () => listOf('items', { limit: 8 }),
    enabled: can('barang.view'),
  })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`Halo, ${user?.name.split(' ')[0] ?? ''}`} />

      <div className="grid gap-3 sm:grid-cols-2">
        {can('barang.create') ? (
          <BigAction to="/barang?baru=1" icon={Plus} label="Tambah barang" />
        ) : null}
        {can('lacak.view') ? <BigAction to="/lacak" icon={Route} label="Lacak barang" /> : null}
        {can('barang.view') && !can('barang.create') ? (
          <BigAction to="/barang" icon={Boxes} label="Lihat barang" />
        ) : null}
      </div>

      {can('barang.view') ? (
        <Section
          title="Barang terbaru"
          aside={
            <Link
              to="/barang"
              className="text-dense text-accent underline-offset-4 hover:underline"
            >
              Semua barang
            </Link>
          }
        >
          <Panel>
            {latest.isPending ? (
              <RowsSkeleton rows={4} label="Memuat barang" />
            ) : latest.isError ? (
              <ErrorState
                error={latest.error}
                onRetry={() => void latest.refetch()}
                retrying={latest.isFetching}
              />
            ) : latest.data.data.length === 0 ? (
              <EmptyState message="Belum ada barang yang tercatat." />
            ) : (
              <ul className="divide-y">
                {latest.data.data.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{i.name}</span>
                      <span className="text-dense text-muted">
                        {i.kind} · asal{' '}
                        <Merged id={i.production_id}>{i.production?.area ?? null}</Merged>
                      </span>
                    </div>
                    <span className="text-dense tabular-nums">
                      {number(i.quantity)} {i.unit}
                    </span>
                    {can('lacak.view') ? (
                      <Link
                        to={`/lacak/${i.id}`}
                        className="text-dense text-accent underline-offset-4 hover:underline"
                        aria-label={`Lacak ${i.name}`}
                      >
                        Lacak
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Section>
      ) : null}
    </div>
  )
}
