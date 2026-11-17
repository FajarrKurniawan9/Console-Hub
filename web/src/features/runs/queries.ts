import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { params, request } from '../../lib/api'
import { isFinalStatus } from '../../lib/runs'
import { many, one, run } from '../../lib/schemas'
import { runAccepted } from '../processes/queries'

export type RunFilters = {
  process_id: string[]
  status: string[]
}

export const runKeys = {
  all: ['runs'] as const,
  list: (f: Record<string, unknown>) => ['runs', 'list', f] as const,
  one: (id: string) => ['runs', id] as const,
}

export function useFailedRuns(limit = 5) {
  return useQuery({
    queryKey: runKeys.list({ status: 'failed', limit }),
    queryFn: () =>
      request(many(run), { url: '/runs', params: params({ status: 'failed', limit }) }),
    refetchInterval: 20_000,
  })
}

export function useRuns(f: RunFilters) {
  return useInfiniteQuery({
    queryKey: runKeys.list(f),
    queryFn: ({ pageParam }) =>
      request(many(run), { url: '/runs', params: params({ ...f, limit: 25, cursor: pageParam }) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor,
    // Keep live rows moving while anything is queued or running.
    refetchInterval: (q) =>
      q.state.data?.pages.some((p) => p.data.some((r) => !isFinalStatus(r.status))) ? 4_000 : false,
  })
}

/** Poll every 2 s until the run is final. Stops while the tab is hidden (TanStack default). */
export function useRun(id: string) {
  return useQuery({
    queryKey: runKeys.one(id),
    queryFn: () => request(one(run), { url: `/runs/${id}` }).then((r) => r.data),
    refetchInterval: (q) => (q.state.data && isFinalStatus(q.state.data.status) ? false : 2_000),
    refetchIntervalInBackground: false,
    staleTime: 0,
  })
}

export function useCancelRun(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      request(one(run), { url: `/runs/${id}/cancel`, method: 'POST' }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(runKeys.one(id), data)
      void qc.invalidateQueries({ queryKey: runKeys.all })
    },
  })
}

export function useRetryRun(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      request(runAccepted, { url: `/runs/${id}/retry`, method: 'POST' }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: runKeys.all }),
  })
}
