import { Link } from 'react-router'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../../components/PageHeader'
import { CardsSkeleton, RowsSkeleton } from '../../../components/Skeletons'
import { TimeText } from '../../../components/TimeText'
import { number } from '../../../lib/format'
import { ACTIONS, summaryOf } from '../audit/summary'
import { ConsoleCard } from '../consoles/ConsoleCard'
import { sortByAttention } from '../consoles/queries'
import { useOverview } from './queries'

const link = 'text-dense text-accent underline-offset-4 hover:underline'

/** Update 2 §4.2: source status, error logs in 24 h, recent audit activity. */
export function OverviewPage() {
  const q = useOverview()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Ringkasan" />

      <Section
        title="Sumber data"
        aside={
          <Link to="/console" className={link}>
            Kelola sumber data
          </Link>
        }
      >
        {q.isPending ? (
          <CardsSkeleton />
        ) : q.isError ? (
          <Panel>
            <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortByAttention(q.data.sources).map((c) => (
              <ConsoleCard key={c.id} console={c} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Log error"
        aside={
          <Link to="/log?level=error" className={link}>
            Semua log error
          </Link>
        }
      >
        <Panel className="px-3 py-2.5 text-dense">
          {q.isPending ? (
            <RowsSkeleton rows={1} label="Memuat jumlah log error" />
          ) : q.isError ? null : (
            <p>
              <span className="font-semibold tabular-nums">{number(q.data.log_errors_24h)}</span>{' '}
              <span className="text-muted">log error dalam 24 jam terakhir</span>
            </p>
          )}
        </Panel>
      </Section>

      <Section
        title="Aktivitas terbaru"
        aside={
          <Link to="/audit" className={link}>
            Semua audit
          </Link>
        }
      >
        <Panel>
          {q.isPending ? (
            <RowsSkeleton rows={5} label="Memuat aktivitas" />
          ) : q.isError ? null : q.data.recent_audit.length === 0 ? (
            <EmptyState message="Belum ada aktivitas. Aktivitas muncul setelah ada data yang diubah atau sumber yang diuji." />
          ) : (
            <ul className="divide-y text-dense">
              {q.data.recent_audit.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-24 shrink-0 text-muted">
                    <TimeText iso={e.created_at} mode="short" />
                  </span>
                  <span className="w-48 shrink-0 truncate font-semibold">
                    {ACTIONS[e.action] ?? e.action}
                  </span>
                  <span className="min-w-0 truncate text-muted">
                    {[e.user?.name, e.target_id, summaryOf(e)].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>
    </div>
  )
}
