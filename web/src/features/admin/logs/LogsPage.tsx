import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, CircleAlert, CircleCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConsoleChip } from '../../../components/ConsoleChip'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader, Panel } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { LevelBadge } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import { Tooltip } from '../../../components/ui/Tooltip'
import { describeError } from '../../../lib/errors'
import { number, shortTime } from '../../../lib/format'
import type { LogSyncResult } from '../../../lib/api/schemas'
import { useUrlState } from '../../../lib/useUrlState'
import { downSince, useConsoles } from '../consoles/queries'
import { LogDetail } from './LogDetail'
import { LogFilters } from './LogFilters'
import {
  logKeys,
  useLogs,
  useNewLogCount,
  useSyncLogs,
  type LogFilters as Filters,
} from './queries'
import { SyncButton } from './SyncButton'
import { DEFAULT_RANGE, resolveRange } from './timeRange'
import { ExportAction } from '../../reports/ExportAction'

export function LogsPage() {
  const url = useUrlState()
  const qc = useQueryClient()
  const consoles = useConsoles()
  // Preset ranges are anchored when a filter changes, not on every render.
  const [anchor, setAnchor] = useState(() => Date.now())
  const reanchor = useCallback(() => setAnchor(Date.now()), [])

  const range = url.get('range') || DEFAULT_RANGE
  const fromLocal = url.get('from')
  const toLocal = url.get('to')
  const consoleIds = url.list('console').join(',')
  const levels = url.list('level').join(',')
  const q = url.get('q')
  const filters: Filters = useMemo(
    () => ({
      console_id: consoleIds ? consoleIds.split(',') : [],
      level: levels ? levels.split(',') : [],
      q,
      ...resolveRange(range, fromLocal, toLocal, anchor),
    }),
    [consoleIds, levels, q, range, fromLocal, toLocal, anchor],
  )

  const logs = useLogs(filters)
  const rows = useMemo(() => logs.data?.pages.flatMap((p) => p.data) ?? [], [logs.data])
  const total = logs.data?.pages[0]?.meta.total
  const newCount = useNewLogCount(filters, logs.isSuccess ? (rows[0]?.id ?? 0) : undefined)
  const [selected, setSelected] = useState<number | null>(null)

  const sync = useSyncLogs()
  const [syncResult, setSyncResult] = useState<LogSyncResult | null>(null)

  // Infinite scroll; the "Muat lebih banyak" button stays as the fallback.
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = logs
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const down = consoles.data?.filter((c) => c.status === 'down') ?? []
  const filterConsoles = filters.console_id
  const relevantDown = down.filter(
    (c) => !filterConsoles.length || filterConsoles.includes(String(c.id)),
  )

  // Reload from the first page: refetching all pages with old cursors could leave gaps.
  const showNew = () => {
    void qc.resetQueries({ queryKey: logKeys.list(filters) })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Log gabungan"
        meta={
          total != null
            ? `${number(total)} log cocok · terbaru di atas`
            : 'Log dari semua console, terbaru di atas'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportAction
              type="logs"
              title="Log Gabungan"
              filterSummary={
                q || consoleIds || levels
                  ? `Filter: ${[q && `Query "${q}"`, consoleIds && 'Console terpilih', levels && `Level ${levels}`].filter(Boolean).join(', ')}`
                  : 'Seluruh log dalam rentang aktif'
              }
              filters={filters}
            />
            <SyncButton
              consoles={consoles.data ?? []}
              pending={sync.isPending}
              onSync={(id) => {
                setSyncResult(null)
                sync.mutate(id, { onSuccess: setSyncResult })
              }}
            />
          </div>
        }
      />

      <LogFilters url={url} consoles={consoles.data ?? []} onApply={reanchor} />

      {sync.isError ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md border border-error px-3 py-2 text-dense"
        >
          <CircleAlert size={16} strokeWidth={1.5} className="text-error" aria-hidden />
          Gagal menarik log: {describeError(sync.error, true).title}.{' '}
          {describeError(sync.error, true).next}
        </p>
      ) : null}
      {syncResult ? <SyncResults results={syncResult} onClose={() => setSyncResult(null)} /> : null}

      {relevantDown.map((c) => {
        const since = downSince(c)
        return (
          <p
            key={c.id}
            role="status"
            className="flex items-center gap-2 rounded-md border border-warn px-3 py-2 text-dense"
          >
            <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-warn" aria-hidden />
            <span>
              Log <span className="font-semibold">{c.name}</span> mungkin tertinggal: tidak dapat
              dihubungi
              {since ? ` sejak ${shortTime(since)}` : ''}. Log console lain tetap diperbarui.
            </span>
          </p>
        )
      })}

      {newCount > 0 ? (
        <button
          type="button"
          onClick={showNew}
          className="sticky top-14 z-20 mx-auto inline-flex items-center gap-1.5 rounded-full border border-accent bg-bg px-3 py-1 text-dense font-semibold text-accent shadow-pop"
        >
          <ArrowUp size={14} strokeWidth={1.5} aria-hidden />
          {newCount >= 50 ? '50+' : newCount} log baru
        </button>
      ) : null}

      <Panel>
        {logs.isPending ? (
          <RowsSkeleton rows={10} label="Memuat log" />
        ) : logs.isError ? (
          <ErrorState
            error={logs.error}
            onRetry={() => void logs.refetch()}
            retrying={logs.isFetching}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            message="Tidak ada log yang cocok dengan filter."
            action={
              <Button
                onClick={() =>
                  url.set({
                    console: null,
                    level: null,
                    q: null,
                    range: null,
                    from: null,
                    to: null,
                  })
                }
              >
                Hapus filter
              </Button>
            }
          />
        ) : (
          <>
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[164px]" />
                <col className="w-[120px]" />
                <col className="w-[88px]" />
                <col />
                <col className="w-[132px]" />
              </colgroup>
              <thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Console</Th>
                  <Th>Tingkat</Th>
                  <Th>Pesan</Th>
                  <Th>Aktor</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const open = () => setSelected(l.id)
                  return (
                    <Tr
                      key={l.id}
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) =>
                        (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())
                      }
                      aria-label={`Buka log ${l.id}`}
                      className={`cursor-pointer hover:bg-surface ${selected === l.id ? 'bg-surface' : ''}`}
                    >
                      <Td className="text-muted">
                        <TimeText iso={l.occurred_at} />
                      </Td>
                      <Td>
                        <ConsoleChip
                          name={l.console.name}
                          down={down.some((c) => c.id === l.console.id)}
                        />
                      </Td>
                      <Td>
                        <LevelBadge level={l.level} />
                      </Td>
                      <Td>
                        <Tooltip content={l.message}>
                          <span className="block truncate">{l.message}</span>
                        </Tooltip>
                      </Td>
                      <Td className="truncate text-muted">{l.actor ?? '—'}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <div ref={sentinel} className="flex items-center justify-center p-3">
              {hasNextPage ? (
                <Button onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? <Spinner /> : null}
                  {isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
                </Button>
              ) : (
                <span className="text-xs text-muted">
                  Semua {number(rows.length)} log sudah tampil.
                </span>
              )}
            </div>
          </>
        )}
      </Panel>

      <LogDetail id={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function SyncResults({ results, onClose }: { results: LogSyncResult; onClose: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-md border px-3 py-2 text-dense">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Hasil tarik log</span>
        <Button variant="ghost" className="h-6 px-2" onClick={onClose}>
          Tutup
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {results.map((r) => (
          <li key={r.console.slug} className="flex items-start gap-2">
            {r.status === 'ok' ? (
              <CircleCheck
                size={16}
                strokeWidth={1.5}
                className="mt-px shrink-0 text-ok"
                aria-hidden
              />
            ) : (
              <CircleAlert
                size={16}
                strokeWidth={1.5}
                className="mt-px shrink-0 text-error"
                aria-hidden
              />
            )}
            <span>
              <span className="font-semibold">{r.console.name}</span>:{' '}
              {r.status === 'ok'
                ? `berhasil, ${r.inserted ?? 0} log baru`
                : `gagal. ${r.error ?? ''}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
