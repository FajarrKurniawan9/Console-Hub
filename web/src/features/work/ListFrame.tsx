import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { Button } from '../../components/ui/Button'
import { inputClass } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import type { Page } from '../../lib/api/schemas'
import { number } from '../../lib/format'
import type { useUrlState } from '../../lib/useUrlState'

/** Shared list page: title + one primary action, search, status filter, and the five states. */
export function ListFrame<T>({
  title,
  noun,
  url,
  statuses,
  primary,
  query,
  emptyMessage,
  emptyAction,
  children,
}: {
  title: string
  /** "karyawan", "barang": used in counts and messages. */
  noun: string
  url: ReturnType<typeof useUrlState>
  statuses: { value: string; label: string }[]
  primary?: ReactNode
  query: UseInfiniteQueryResult<InfiniteData<Page<T>>>
  emptyMessage: string
  emptyAction?: ReactNode
  children: (rows: T[]) => ReactNode
}) {
  const [term, setTerm] = useState(url.get('q'))
  const q = url.get('q')
  // Debounced search into the URL.
  useEffect(() => {
    if (term === q) return
    const t = setTimeout(() => url.set({ q: term || null }), 300)
    return () => clearTimeout(t)
  }, [term, q, url])

  const rows = query.data?.pages.flatMap((p) => p.data) ?? []
  const total = query.data?.pages[0]?.meta.total
  const filtered = !!(q || url.get('status'))

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={title}
        meta={total != null ? `${number(total)} ${noun}` : undefined}
        actions={primary}
      />
      <div role="search" aria-label={`Cari ${noun}`} className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-56 flex-1 items-center sm:max-w-80">
          <span className="sr-only">Cari {noun}</span>
          <Search
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-2.5 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Cari ${noun}…`}
            className={`${inputClass} w-full pl-8`}
          />
        </label>
        <label className="flex items-center gap-1.5 text-dense">
          <span className="text-muted">Status</span>
          <Select
            value={url.get('status')}
            onChange={(e) => url.set({ status: e.target.value || null })}
          >
            <option value="">Semua</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <Panel>
        {query.isPending ? (
          <RowsSkeleton rows={8} label={`Memuat ${noun}`} />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              message={`Tidak ada ${noun} yang cocok dengan pencarian atau filter.`}
              action={
                <Button
                  onClick={() => {
                    setTerm('')
                    url.set({ q: null, status: null })
                  }}
                >
                  Hapus filter
                </Button>
              }
            />
          ) : (
            <EmptyState message={emptyMessage} action={emptyAction} />
          )
        ) : (
          <>
            {children(rows)}
            {query.hasNextPage ? (
              <div className="flex justify-center p-3">
                <Button
                  onClick={() => void query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage ? <Spinner /> : null}
                  {query.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  )
}
