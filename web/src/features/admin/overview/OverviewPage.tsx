import { Link } from 'react-router'
import { ConsoleChip } from '../../../components/ConsoleChip'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../../components/PageHeader'
import { CardsSkeleton, RowsSkeleton } from '../../../components/Skeletons'
import { Dot, LevelBadge, TxStateBadge } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { TX_STATES, type ConsistencyCheck, type Overview } from '../../../lib/api/schemas'
import { number } from '../../../lib/format'
import { TX_STATE } from '../../../lib/status'
import { ConsoleCard } from '../consoles/ConsoleCard'
import { sortByAttention } from '../consoles/queries'
import { useLogs } from '../logs/queries'
import { opLabel, reasonOf } from '../transactions/labels'
import { useOverview } from './queries'

const ERROR_LOGS = { console_id: [], level: ['error'], q: '', from: null, to: null }
const link = 'text-dense text-accent underline-offset-4 hover:underline'

/** Brief 8.3, in order: console status, needs attention, recent transactions, last consistency check. */
export function OverviewPage() {
  const q = useOverview()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ringkasan"
        meta={q.data ? <TxCounts counts={q.data.tx_counts} /> : undefined}
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

      <Attention overview={q.data} />

      <Section
        title="Transaksi terbaru"
        aside={
          <Link to="/transaksi" className={link}>
            Semua transaksi
          </Link>
        }
      >
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
                    <span className="w-40 shrink-0 truncate">{opLabel(t.operation)}</span>
                    <span className="min-w-0 truncate text-muted">
                      {reasonOf(t) || t.requested_by.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>

      <Section
        title="Konsistensi data"
        aside={
          <Link to="/konsistensi" className={link}>
            Buka konsistensi
          </Link>
        }
      >
        <Panel className="px-3 py-2.5 text-dense">
          {q.isPending ? (
            <RowsSkeleton rows={1} label="Memuat pemeriksaan" />
          ) : q.isError ? null : (
            <LastCheck check={q.data.last_consistency} />
          )}
        </Panel>
      </Section>
    </div>
  )
}

/** Small text, not KPI cards. Only non-zero states. */
function TxCounts({ counts }: { counts: Overview['tx_counts'] }) {
  const parts = TX_STATES.filter((s) => counts[s]).map(
    (s) => `${number(counts[s]!)} ${TX_STATE[s].label.toLowerCase()}`,
  )
  return parts.length ? <>Transaksi: {parts.join(' · ')}</> : null
}

const ENTITY: Record<ConsistencyCheck['entity_type'], string> = {
  divisi: 'Divisi',
  karyawan: 'Karyawan',
  barang: 'Barang',
}

function LastCheck({ check }: { check: ConsistencyCheck | null }) {
  if (!check)
    return <p className="text-muted">Belum ada pemeriksaan. Jalankan dari halaman Konsistensi.</p>
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold">{ENTITY[check.entity_type]}</span>
      {check.status === 'clean' ? (
        <Dot tone="ok" label={`Bersih (${check.checked_count} data)`} />
      ) : check.status === 'drift' ? (
        <Dot tone="error" label={`${check.drift_count} temuan dari ${check.checked_count} data`} />
      ) : check.status === 'running' ? (
        <Dot tone="accent" label="Sedang berjalan" pulse />
      ) : (
        <Dot tone="error" label="Gagal dijalankan" />
      )}
      <span className="text-muted">
        <TimeText iso={check.started_at} mode="relative" />
      </span>
      {check.status === 'drift' ? (
        <Link to={`/konsistensi?check=${check.id}`} className={link}>
          Lihat temuan
        </Link>
      ) : null}
    </p>
  )
}

/** Up to 5 lines: needs_attention first, then aborted transactions and error logs by time. */
function Attention({ overview }: { overview: Overview | undefined }) {
  const logs = useLogs(ERROR_LOGS)
  const txs = (overview?.recent_transactions ?? []).filter(
    (t) => t.state === 'needs_attention' || t.state === 'aborted',
  )
  const items = [
    ...txs.map((t) => ({
      kind: 'tx' as const,
      at: t.created_at,
      rank: t.state === 'needs_attention' ? 0 : 1,
      tx: t,
    })),
    ...(logs.data?.pages[0]?.data
      .slice(0, 5)
      .map((l) => ({ kind: 'log' as const, at: l.occurred_at, rank: 1, log: l })) ?? []),
  ]
    .sort((a, b) => a.rank - b.rank || b.at.localeCompare(a.at))
    .slice(0, 5)

  return (
    <Section
      title={
        <>
          Perlu perhatian
          {overview ? (
            <span className="ml-2 text-dense font-normal text-muted">
              {number(overview.error_logs_24h)} log error dalam 24 jam
            </span>
          ) : null}
        </>
      }
      aside={
        <Link to="/log?level=error" className={link}>
          Semua log error
        </Link>
      }
    >
      <Panel>
        {logs.isPending || !overview ? (
          <RowsSkeleton rows={5} label="Memuat hal yang perlu perhatian" />
        ) : logs.isError ? (
          <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState message="Tidak ada transaksi bermasalah atau log error. Semua berjalan normal." />
        ) : (
          <ul className="divide-y text-dense">
            {items.map((it) =>
              it.kind === 'tx' ? (
                <li key={`t${it.tx.id}`}>
                  <Link
                    to={`/transaksi/${it.tx.id}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface"
                  >
                    <span className="w-24 shrink-0 text-muted">
                      <TimeText iso={it.at} mode="short" />
                    </span>
                    <span className="w-32 shrink-0">
                      <TxStateBadge state={it.tx.state} />
                    </span>
                    <span className="shrink-0 font-semibold">{opLabel(it.tx.operation)}</span>
                    <span className="min-w-0 truncate text-muted">{reasonOf(it.tx)}</span>
                  </Link>
                </li>
              ) : (
                <li key={`l${it.log.id}`}>
                  <Link
                    to={`/log?console=${it.log.console.id}&level=error`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface"
                  >
                    <span className="w-24 shrink-0 text-muted">
                      <TimeText iso={it.at} mode="short" />
                    </span>
                    <span className="w-32 shrink-0">
                      <LevelBadge level="error" />
                    </span>
                    <ConsoleChip name={it.log.console.name} />
                    <span className="min-w-0 truncate">{it.log.message}</span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}
      </Panel>
    </Section>
  )
}
