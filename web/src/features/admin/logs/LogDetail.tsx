import { ConsoleChip } from '../../../components/ConsoleChip'
import { ErrorState } from '../../../components/ErrorState'
import { JsonView } from '../../../components/JsonView'
import { RowsSkeleton } from '../../../components/Skeletons'
import { LevelBadge } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { Sheet } from '../../../components/ui/Sheet'
import { useLog } from './queries'

export function LogDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const q = useLog(id)
  return (
    <Sheet
      open={id !== null}
      onOpenChange={(o) => !o && onClose()}
      title={<span className="font-mono">Log #{id}</span>}
      description={q.data ? q.data.console.name : 'Memuat…'}
    >
      {q.isPending ? (
        <RowsSkeleton rows={5} label="Memuat log" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm break-words whitespace-pre-wrap">{q.data.message}</p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-dense">
            <dt className="text-muted">Waktu</dt>
            <dd>
              <TimeText iso={q.data.occurred_at} />
            </dd>
            <dt className="text-muted">Console</dt>
            <dd>
              <ConsoleChip name={q.data.console.name} />
            </dd>
            <dt className="text-muted">Tingkat</dt>
            <dd>
              <LevelBadge level={q.data.level} />
            </dd>
            <dt className="text-muted">Aktor</dt>
            <dd>{q.data.actor ?? <span className="text-muted">sistem / tidak diketahui</span>}</dd>
            <dt className="text-muted">ID</dt>
            <dd className="font-mono">{q.data.id}</dd>
          </dl>
          <JsonView value={q.data.raw} label={`Data mentah dari ${q.data.console.name}`} />
        </div>
      )}
    </Sheet>
  )
}
