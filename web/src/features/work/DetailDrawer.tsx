import type { ReactNode } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { RowsSkeleton } from '../../components/Skeletons'
import { Sheet } from '../../components/ui/Sheet'
import type { Resource, Row } from '../../lib/api/work'
import { useWorkOne } from './queries'

/**
 * Detail side panel. Shows the row from the list at once, then refreshes it from
 * `GET /{resource}/{id}` (the detail may carry more merged data).
 */
export function DetailDrawer<R extends Resource>({
  resource,
  row,
  title,
  onClose,
  footer,
  children,
}: {
  resource: R
  row: Row<R> | null
  title: (row: Row<R>) => string
  onClose: () => void
  footer?: (row: Row<R>) => ReactNode
  children: (row: Row<R>) => ReactNode
}) {
  const q = useWorkOne(resource, row?.id ?? null)
  const shown = (q.data as Row<R> | undefined) ?? row
  return (
    <Sheet
      open={!!row}
      onOpenChange={(o) => !o && onClose()}
      title={shown ? title(shown) : ''}
      footer={shown && footer ? footer(shown) : undefined}
    >
      {!shown ? (
        <RowsSkeleton rows={4} />
      ) : (
        <div className="flex flex-col gap-4">
          {children(shown)}
          {q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
          ) : null}
        </div>
      )}
    </Sheet>
  )
}
