import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { RowsSkeleton } from './Skeletons'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

type ListQuery = {
  rows: unknown[] | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  isFetching: boolean
  isPlaceholderData?: boolean
  refetch: () => unknown
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => unknown
}

/** Satu tempat untuk memuat / galat / kosong / muat lebih banyak di setiap daftar. */
export function ListFrame({
  query,
  empty,
  label,
  children,
}: {
  query: ListQuery
  empty: string
  label: string
  children: ReactNode
}) {
  if (query.isPending) return <RowsSkeleton label={`Memuat ${label}`} />
  if (query.isError && !query.rows?.length)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
  if (!query.rows?.length) return <EmptyState message={empty} />
  return (
    <div aria-busy={query.isFetching} className={query.isPlaceholderData ? 'opacity-60' : undefined}>
      {children}
      {query.hasNextPage ? (
        <div className="border-t px-3 py-2">
          <Button
            variant="ghost"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage?.()}
          >
            {query.isFetchingNextPage ? <Spinner /> : null}
            Muat lebih banyak
          </Button>
        </div>
      ) : null}
    </div>
  )
}
