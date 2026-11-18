import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import type { Transaction } from '../../lib/api/schemas'
import { duration } from '../../lib/format'
import { ErrorState } from '../ErrorState'
import { RowsSkeleton } from '../Skeletons'
import { Dot } from '../StatusDot'
import { Button } from '../ui/Button'
import { TrailFrame } from './TrailFrame'
import {
  byConsoleOrder,
  responseMs,
  ROW_STATUS,
  rowStatus,
  trailSummary,
  useAdminTrail,
} from './useTransactionTrail'

/** Admin rows for a transaction that is already loaded (also used read-only on Transaksi detail). */
export function TrailRows({ tx, version }: { tx: Transaction; version?: number }) {
  const summary = trailSummary(tx)
  return (
    <>
      <p className="text-dense">
        <Dot tone={summary.tone} label={summary.text} className="font-semibold" />
      </p>
      <table className="w-full border-collapse text-dense">
        <caption className="sr-only">Hasil per console untuk {tx.id}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-1 pr-3 font-semibold">
              Console
            </th>
            <th scope="col" className="py-1 pr-3 font-semibold">
              Status
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-semibold">
              Waktu respons
            </th>
            <th scope="col" className="py-1 text-right font-semibold">
              Versi
            </th>
          </tr>
        </thead>
        <tbody>
          {byConsoleOrder(tx.participants).map((p) => {
            const s = rowStatus(p, tx.state)
            const ms = responseMs(p, tx)
            return (
              <tr key={p.console.slug} className="border-t align-top">
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold">
                  {p.console.name}
                </th>
                <td className="py-1.5 pr-3">
                  <Dot {...ROW_STATUS[s]} pulse={s === 'menyelesaikan'} />
                  {p.refusal_code ? (
                    <span className="block text-xs">
                      <span className="font-mono text-error">{p.refusal_code}</span>{' '}
                      <span className="text-muted">{p.refusal_message}</span>
                    </span>
                  ) : p.last_error && s === 'tidak_merespons' ? (
                    <span className="block font-mono text-xs text-muted">{p.last_error}</span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                  {ms !== null ? duration(ms) : '—'}
                </td>
                <td className="py-1.5 text-right font-mono">
                  {s === 'tersimpan' && version !== undefined ? `v${version}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}

/** After a write: polls `GET /admin/transactions/{id}` until final or the time limit. */
export function ConsoleTrailAdmin({
  txId,
  version,
  onClose,
}: {
  txId: string
  version?: number
  onClose?: () => void
}) {
  const { query, timedOut, restart } = useAdminTrail(txId)
  const tone = query.data ? trailSummary(query.data).tone : 'muted'
  return (
    <TrailFrame title="Jejak 3 console" tone={tone} onClose={onClose}>
      {query.isPending ? (
        <RowsSkeleton rows={3} label="Memuat jejak console" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={restart} retrying={query.isFetching} />
      ) : (
        <>
          <TrailRows tx={query.data} version={version} />
          {timedOut ? (
            <p className="flex flex-wrap items-center gap-2 text-dense text-muted">
              Belum selesai setelah 1 menit; pemantauan dihentikan.
              <Button variant="ghost" onClick={restart}>
                <RefreshCw size={16} strokeWidth={1.5} aria-hidden />
                Cek lagi
              </Button>
            </p>
          ) : null}
          <Link
            to={`/transaksi/${query.data.id}`}
            className="self-start text-dense text-accent underline-offset-4 hover:underline"
          >
            Lihat transaksi <span className="font-mono">{query.data.id}</span>
          </Link>
        </>
      )}
    </TrailFrame>
  )
}
