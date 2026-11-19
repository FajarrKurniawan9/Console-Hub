import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { z } from 'zod'
import { request, type RequestOptions } from './client'
import * as s from './schemas'

type Query = RequestOptions['query']

/** Kunci query per sumber; penyesuaian stok me-refetch semua yang bergantung pada stok. */
export const keys = {
  dashboard: ['dashboard'] as const,
  items: ['items'] as const,
  item: (id: string) => ['items', id] as const,
  racks: ['racks'] as const,
  stock: ['stock'] as const,
  movements: ['movements'] as const,
  reservations: ['reservations'] as const,
  areaAccess: ['area-access'] as const,
  logs: ['logs'] as const,
}

/** Daftar bercursor: `pages` digabung, `fetchNextPage` untuk "Muat lebih banyak". */
function usePaged<S extends z.ZodType>(key: readonly string[], path: string, schema: S, query: Query) {
  const q = useInfiniteQuery({
    queryKey: [...key, query],
    queryFn: ({ pageParam, signal }) =>
      request(s.pagedOf(schema), path, { query: { ...query, cursor: pageParam }, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor,
    placeholderData: keepPreviousData,
  })
  return { ...q, rows: q.data?.pages.flatMap((p) => p.data as z.infer<S>[]) }
}

export type PagedQuery<T> = ReturnType<typeof usePaged<z.ZodType<T>>>

export const useDashboard = () =>
  useQuery({
    queryKey: keys.dashboard,
    queryFn: ({ signal }) => request(s.dataOf(s.dashboard), '/dashboard', { signal }).then((r) => r.data),
  })

export const useItems = (q: Query) => usePaged(keys.items, '/items', s.item, q)
export const useItem = (id: string | null) =>
  useQuery({
    queryKey: keys.item(id ?? ''),
    queryFn: ({ signal }) => request(s.dataOf(s.itemDetail), `/items/${id}`, { signal }).then((r) => r.data),
    enabled: !!id,
  })

export const useRacks = (q: Query) => usePaged(keys.racks, '/racks', s.rack, q)
export const useStock = (q: Query) => usePaged(keys.stock, '/stock', s.stockLine, q)
export const useMovements = (q: Query) => usePaged(keys.movements, '/stock/movements', s.stockMovement, q)
export const useReservations = (q: Query) => usePaged(keys.reservations, '/reservations', s.reservation, q)
export const useAreaAccess = (q: Query) => usePaged(keys.areaAccess, '/area-access', s.areaAccess, q)
export const useLogs = (q: Query) => usePaged(keys.logs, '/logs', s.logEntry, q)
