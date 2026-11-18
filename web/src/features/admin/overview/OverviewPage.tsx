import { Link } from 'react-router'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../../components/PageHeader'
import { CardsSkeleton, RowsSkeleton } from '../../../components/Skeletons'
import { TxStateBadge } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { number } from '../../../lib/format'
import { ConsoleCard } from '../consoles/ConsoleCard'
import { sortByAttention } from '../consoles/queries'
import { useOverview } from './queries'

// Phase 1: consoles + recent transactions. "Perlu perhatian" and consistency come in phase 3.
export function OverviewPage() {
  const q = useOverview()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ringkasan"
        meta={q.data ? `${number(q.data.error_logs_24h)} log error dalam 24 jam` : undefined}
      />
      <Section title="Console">
        {q.isPending ? (
          <CardsSkeleton />
        ) : q.isError ? (
          <Panel>
            <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortByAttention(q.data.consoles).map((c) => (
              <ConsoleCard key={c.id} console={c} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Transaksi terbaru">
        <Panel>
          {q.isPending ? (
            <RowsSkeleton rows={5} label="Memuat transaksi" />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : q.data.recent_transactions.length === 0 ? (
            <EmptyState message="Belum ada transaksi. Transaksi muncul setelah ada data kerja yang diubah." />
          ) : (
            <ul className="divide-y text-dense">
              {q.data.recent_transactions.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/transaksi/${t.id}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface"
                  >
                    <span className="w-24 shrink-0 text-muted">
                      <TimeText iso={t.created_at} mode="short" />
                    </span>
                    <span className="w-32 shrink-0">
                      <TxStateBadge state={t.state} />
                    </span>
                    <span className="shrink-0 font-mono">{t.operation}</span>
                    <span className="min-w-0 truncate text-muted">
                      {t.failure_message ?? t.requested_by.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>
    </div>
  )
}
