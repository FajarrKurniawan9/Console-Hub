import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { CircleAlert, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { Button } from '../../components/ui/Button'
import { inputClass } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import type { Page, Source } from '../../lib/api/schemas'
import { useIsAdminView } from '../../lib/permissions'
import type { useUrlState } from '../../lib/useUrlState'
import { SOURCE_LABEL } from './labels'
import { unavailableOf } from './unavailable'

/** Thin warning line: Admin sees which source, User a plain sentence. */
export function UnavailableBar({ sources, owner }: { sources: Source[]; owner: Source }) {
  const admin = useIsAdminView()
  if (!sources.length) return null
  const ownerDown = sources.includes(owner)
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-start gap-2 rounded-md border border-warn px-3 py-2 text-dense"
    >
      <CircleAlert size={16} strokeWidth={1.5} className="mt-px shrink-0 text-warn" aria-hidden />
      {admin ? (
        <span>
          API sumber <span className="font-semibold">{sources.map((s) => SOURCE_LABEL[s]).join(', ')}</span>{' '}
          tidak tersedia.{' '}
          {ownerDown
            ? `Data ${SOURCE_LABEL[owner]} tidak dapat dibaca atau diubah sampai sumbernya pulih.`
            : 'Kolom gabungan dari sumber itu tampil "Tidak tersedia"; perubahan data tetap bisa disimpan.'}
        </span>
      ) : ownerDown ? (
        <span>Layanan sedang bermasalah, perubahan data sementara tidak dapat disimpan.</span>
      ) : (
        <span>Sebagian keterangan sedang tidak tersedia. Data lain tetap tampil.</span>
      )}
    </p>
  )
}

/** Shared list page: title + one primary action, search, filters, and every list state. */
export function ListFrame<T>({
  title,
  noun,
  url,
  owner,
  statuses,
  filters,
  filterKeys = [],
  primary,
  query,
  emptyMessage,
  emptyAction,
  children,
}: {
  title: string
  /** "barang", "personel": used in messages. */
  noun: string
  url: ReturnType<typeof useUrlState>
  /** Source API that holds this data. Writes are off while it is down. */
  owner: Source
  statuses: { value: string; label: string }[]
  /** Extra filter controls next to Status, and the URL keys they set. */
  filters?: ReactNode
  filterKeys?: string[]
  primary?: (writable: boolean) => ReactNode
  query: UseInfiniteQueryResult<InfiniteData<Page<T>>>
  emptyMessage: string
  emptyAction?: ReactNode
  children: (rows: T[], writable: boolean) => ReactNode
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
  const unavailable = unavailableOf(
    query as UseInfiniteQueryResult<InfiniteData<Page<unknown>>>,
    owner,
  )
  const writable = !unavailable.includes(owner)
  const keys = ['q', 'status', ...filterKeys]
  const filtered = keys.some((k) => url.get(k))

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={title} actions={primary?.(writable)} />
      <UnavailableBar sources={unavailable} owner={owner} />
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
            <option value="">Aktif saja</option>
            {statuses
              .filter((s) => s.value !== 'aktif')
              .map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
          </Select>
        </label>
        {filters}
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
                    url.set(Object.fromEntries(keys.map((k) => [k, null])))
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
            {children(rows, writable)}
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
