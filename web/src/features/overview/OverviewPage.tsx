import { Link } from 'react-router'
import { ConsoleChip } from '../../components/ConsoleChip'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../components/PageHeader'
import { CardsSkeleton, RowsSkeleton } from '../../components/Skeletons'
import { LevelBadge, RunStatusDot } from '../../components/StatusDot'
import { TimeText } from '../../components/TimeText'
import { number } from '../../lib/format'
import { ConsoleCard } from '../consoles/ConsoleCard'
import { sortByAttention } from '../consoles/queries'
import { useLogs } from '../logs/queries'
import { RunsTable } from '../runs/RunsTable'
import { useFailedRuns } from '../runs/queries'
import { useOverview } from './queries'

const ERROR_LOGS = { console_id: [], level: ['error'], q: '', from: null, to: null }

export function OverviewPage() {
  const q = useOverview()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Ringkasan" />
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

      <Attention errorCount={q.data?.error_logs_24h} />

      <Section
        title="Eksekusi terbaru"
        aside={
          <Link to="/runs" className="text-dense text-accent underline-offset-4 hover:underline">
            Semua eksekusi
          </Link>
        }
      >
        <Panel>
          {q.isPending ? (
            <RowsSkeleton rows={5} label="Memuat eksekusi" />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : q.data.recent_runs.length === 0 ? (
            <EmptyState
              message="Belum ada eksekusi. Jalankan proses dari halaman Proses."
              action={
                <Link
                  to="/processes"
                  className="text-dense text-accent underline-offset-4 hover:underline"
                >
                  Buka Proses
                </Link>
              }
            />
          ) : (
            <RunsTable runs={q.data.recent_runs.slice(0, 5)} />
          )}
        </Panel>
      </Section>
    </div>
  )
}

/** Up to 5 lines: newest error logs (max 3) and failed runs (max 2), merged by time. */
function Attention({ errorCount }: { errorCount: number | undefined }) {
  const logs = useLogs(ERROR_LOGS)
  const runs = useFailedRuns(5)
  const items = [
    ...(logs.data?.pages[0]?.data
      .slice(0, runs.data?.data.length ? 3 : 5)
      .map((l) => ({ kind: 'log' as const, at: l.occurred_at, log: l })) ?? []),
    ...(runs.data?.data
      .slice(0, 2)
      .map((r) => ({ kind: 'run' as const, at: r.finished_at ?? r.created_at, run: r })) ?? []),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5)

  const pending = logs.isPending || runs.isPending
  const error = logs.error ?? runs.error

  return (
    <Section
      title={
        <>
          Perlu perhatian
          {errorCount !== undefined ? (
            <span className="ml-2 text-dense font-normal text-muted">
              {number(errorCount)} log error dalam 24 jam
            </span>
          ) : null}
        </>
      }
      aside={
        <Link
          to="/logs?level=error"
          className="text-dense text-accent underline-offset-4 hover:underline"
        >
          Semua log error
        </Link>
      }
    >
      <Panel>
        {pending ? (
          <RowsSkeleton rows={5} label="Memuat hal yang perlu perhatian" />
        ) : error ? (
          <ErrorState
            error={error}
            onRetry={() => {
              void logs.refetch()
              void runs.refetch()
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState message="Tidak ada log error atau eksekusi gagal. Semua berjalan normal." />
        ) : (
          <ul className="divide-y text-dense">
            {items.map((it) =>
              it.kind === 'log' ? (
                <li key={`l${it.log.id}`}>
                  <Link
                    to={`/logs?console=${it.log.console.id}&level=error`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface"
                  >
                    <span className="w-24 shrink-0 text-muted">
                      <TimeText iso={it.at} mode="short" />
                    </span>
                    <span className="w-24 shrink-0">
                      <LevelBadge level="error" />
                    </span>
                    <ConsoleChip name={it.log.console.name} />
                    <span className="min-w-0 truncate">{it.log.message}</span>
                  </Link>
                </li>
              ) : (
                <li key={`r${it.run.id}`}>
                  <Link
                    to={`/runs/${it.run.id}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface"
                  >
                    <span className="w-24 shrink-0 text-muted">
                      <TimeText iso={it.at} mode="short" />
                    </span>
                    <span className="w-24 shrink-0">
                      <RunStatusDot status={it.run.status} />
                    </span>
                    <span className="shrink-0 font-semibold">{it.run.process.name}</span>
                    <span className="min-w-0 truncate text-muted">{it.run.error_summary}</span>
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
