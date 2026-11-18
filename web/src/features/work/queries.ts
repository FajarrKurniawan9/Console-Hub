import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { listOf, type Resource } from '../../lib/api/work'

export const workKeys = {
  all: (r: Resource) => ['work', r] as const,
  list: (r: Resource, q: string, status: string) => ['work', r, 'list', q, status] as const,
  options: (r: Resource) => ['work', r, 'options'] as const,
}

/** Cursor-paged list with search and status filter. */
export function useWorkList<R extends Resource>(r: R, q: string, status: string) {
  return useInfiniteQuery({
    queryKey: workKeys.list(r, q, status),
    queryFn: ({ pageParam }) => listOf(r, { q, status, cursor: pageParam, limit: 50 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor,
  })
}

/** Small option lists for form selects (active rows only). */
export function useOptions<R extends Resource>(r: R, enabled = true) {
  return useQuery({
    queryKey: workKeys.options(r),
    queryFn: () =>
      listOf(r, { status: r === 'orders' ? 'ANTRE' : 'aktif', limit: 200 }).then((p) => p.data),
    enabled,
    staleTime: 30_000,
  })
}
