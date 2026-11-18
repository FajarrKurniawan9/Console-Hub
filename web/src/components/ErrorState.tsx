import { CircleAlert, RefreshCw } from 'lucide-react'
import { describeError } from '../lib/errors'
import { useIsAdminView } from '../lib/permissions'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

/** Says what failed, where, and what to do next. Never a bare "Terjadi kesalahan". Technical detail only in the Admin IT view. */
export function ErrorState({
  error,
  onRetry,
  retrying,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
}) {
  const technical = useIsAdminView()
  const d = describeError(error, technical)
  return (
    <div role="alert" className="flex flex-col items-start gap-2 px-4 py-6">
      <p className="flex items-center gap-2 font-semibold">
        <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-error" aria-hidden />
        {d.title}
      </p>
      <p className="text-muted">{d.next}</p>
      {technical ? (
        <p className="font-mono text-xs text-muted">
          {d.code}
          {d.error.status ? ` · HTTP ${d.error.status}` : ''} · {d.message}
        </p>
      ) : d.message && d.code !== 'NETWORK' && d.code !== 'CONTRACT_MISMATCH' ? (
        // API messages for users are already business sentences (brief 2).
        <p className="text-muted">{d.message}</p>
      ) : null}
      {onRetry ? (
        <Button onClick={onRetry} disabled={retrying} className="mt-1">
          {retrying ? <Spinner /> : <RefreshCw size={16} strokeWidth={1.5} aria-hidden />}
          Coba lagi
        </Button>
      ) : null}
    </div>
  )
}
