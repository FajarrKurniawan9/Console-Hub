import { RefreshCw } from 'lucide-react'
import { ErrorState } from '../ErrorState'
import { Skeleton } from '../Skeletons'
import { Dot } from '../StatusDot'
import { Button } from '../ui/Button'
import { TrailFrame } from './TrailFrame'
import { useUserTrail, userTrailMessage } from './useTransactionTrail'

function Message({
  state,
  reason,
}: {
  state: Parameters<typeof userTrailMessage>[0]
  reason?: string
}) {
  const m = userTrailMessage(state, reason)
  return (
    <>
      <p>
        <Dot tone={m.tone} label={m.text} pulse={m.tone === 'accent'} className="font-semibold" />
      </p>
      {m.reason ? <p className="text-muted">{m.reason}</p> : null}
    </>
  )
}

/**
 * User: one sentence, no console names, no times, no codes.
 * Reads only `GET /transactions/{id}`; a failure known up front (refused before any
 * transaction id reached the User) is shown without a request.
 */
export function ConsoleTrailUser({
  txId,
  failure,
  onClose,
}: {
  txId: string | null
  failure?: string
  onClose?: () => void
}) {
  const { query, timedOut, restart } = useUserTrail(failure ? null : txId)
  const title = 'Status penyimpanan'
  if (failure)
    return (
      <TrailFrame title={title} tone="error" onClose={onClose}>
        <Message state="failed" reason={failure} />
      </TrailFrame>
    )
  const tone = userTrailMessage(query.data?.state ?? 'preparing').tone
  return (
    <TrailFrame title={title} tone={tone} onClose={onClose}>
      {query.isPending ? (
        <Skeleton className="h-5 w-56" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={restart} retrying={query.isFetching} />
      ) : (
        <>
          <Message state={query.data.state} reason={query.data.message} />
          {timedOut ? (
            <p className="flex flex-wrap items-center gap-2 text-muted">
              Masih diproses. Anda boleh lanjut bekerja; cek lagi nanti.
              <Button variant="ghost" onClick={restart}>
                <RefreshCw size={16} strokeWidth={1.5} aria-hidden />
                Cek lagi
              </Button>
            </p>
          ) : null}
        </>
      )}
    </TrailFrame>
  )
}
