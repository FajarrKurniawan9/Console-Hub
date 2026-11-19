import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getOne, listOf, trackItem, type ListQuery, type Resource } from '../../lib/api/work'

export const workKeys = {
  // Merged columns cross resources, so a write refreshes every work list.
  root: ['work'] as const,
  all: (r: Resource) => ['work', r] as const,
  list: (r: Resource, q: ListQuery) => ['work', r, 'list', q] as const,
  one: (r: Resource, id: string) => ['work', r, 'one', id] as const,
  options: (r: Resource) => ['work', r, 'options'] as const,
  tracking: (id: string) => ['work', 'tracking', id] as const,
}

/** Cursor-paged list with search and filters. */
export function useWorkList(r: Resource, q: Omit<ListQuery, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: workKeys.list(r, q),
    queryFn: ({ pageParam }) => listOf(r, { ...q, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor,
  })
}

export function useWorkOne(r: Resource, id: string | null) {
  return useQuery({
    queryKey: workKeys.one(r, id ?? ''),
    queryFn: () => getOne(r, id!),
    enabled: !!id,
  })
}

/** Option lists for form pickers (active rows only). */
export function useOptions(r: Resource, enabled = true) {
  return useQuery({
    queryKey: workKeys.options(r),
    queryFn: () => listOf(r, { status: 'aktif', limit: 100 }).then((p) => p.data),
    enabled,
    staleTime: 30_000,
  })
}

export function useTracking(id: string | null) {
  return useQuery({
    queryKey: workKeys.tracking(id ?? ''),
    queryFn: () => trackItem(id!),
    enabled: !!id,
  })
}
