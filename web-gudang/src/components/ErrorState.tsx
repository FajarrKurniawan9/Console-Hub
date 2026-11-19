import { CircleAlert, RefreshCw } from 'lucide-react'
import { errorMessage } from '../lib/errors'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

export function ErrorState({
  error,
  onRetry,
  retrying,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 px-4 py-6">
      <p className="flex items-center gap-2 font-semibold">
        <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-error" aria-hidden />
        Data tidak dapat dimuat.
      </p>
      <p className="text-muted">{errorMessage(error)}</p>
      {onRetry ? (
        <Button onClick={onRetry} disabled={retrying} className="mt-1">
          {retrying ? <Spinner /> : <RefreshCw size={14} strokeWidth={1.5} aria-hidden />}
          Coba lagi
        </Button>
      ) : null}
    </div>
  )
}
