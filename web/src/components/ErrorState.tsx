import { CircleAlert, RefreshCw } from 'lucide-react'
import { useConsoleName } from '../features/consoles/queries'
import { describeError } from '../lib/errors'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

/** Says what failed, where, and what to do next. Never a bare "Terjadi kesalahan". */
export function ErrorState({
  error,
  onRetry,
  retrying,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
}) {
  const consoleName = useConsoleName()
  const d = describeError(error, consoleName)
  return (
    <div role="alert" className="flex flex-col items-start gap-2 px-4 py-6">
      <p className="flex items-center gap-2 font-semibold">
        <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-error" aria-hidden />
        {d.title}
      </p>
      <p className="text-muted">{d.next}</p>
      <p className="font-mono text-xs text-muted">
        {d.code}
        {d.error.status ? ` · HTTP ${d.error.status}` : ''} · {d.message}
      </p>
      {onRetry ? (
        <Button onClick={onRetry} disabled={retrying} className="mt-1">
          {retrying ? <Spinner /> : <RefreshCw size={16} strokeWidth={1.5} aria-hidden />}
          Coba lagi
        </Button>
      ) : null}
    </div>
  )
}
