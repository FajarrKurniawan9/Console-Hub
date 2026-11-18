import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { params, request } from '../../../lib/api/client'
import { FINAL_TX_STATES, many, one, transaction, txStatus } from '../../../lib/api/schemas'

export const txKeys = {
  all: ['transactions'] as const,
  list: (state: string[], operation: string) => ['transactions', 'list', state, operation] as const,
  one: (id: string) => ['transactions', 'one', id] as const,
}

export function useTransactions(state: string[], operation: string) {
  return useInfiniteQuery({
    queryKey: txKeys.list(state, operation),
    queryFn: ({ pageParam }) =>
      request(many(transaction), {
        url: '/admin/transactions',
        params: params({ state, operation, limit: 50, cursor: pageParam }),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor,
    // Keep the list fresh while something is still in flight.
    refetchInterval: (q) =>
      q.state.data?.pages.some((p) => p.data.some((t) => !FINAL_TX_STATES.includes(t.state)))
        ? 4000
        : false,
  })
}

/** Polls every 2 s while the transaction is not final and the tab is visible. */
export function useTransaction(id: string) {
  return useQuery({
    queryKey: txKeys.one(id),
    queryFn: () =>
      request(one(transaction), { url: `/admin/transactions/${id}` }).then((r) => r.data),
    refetchInterval: (q) => {
      const s = q.state.data?.state
      return s && !FINAL_TX_STATES.includes(s) ? 2000 : false
    },
    refetchIntervalInBackground: false,
  })
}

export function useResolve(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action: 'retry_commit' | 'abort') =>
      request(one(txStatus.pick({ id: true, state: true })), {
        url: `/admin/transactions/${id}/resolve`,
        method: 'POST',
        data: { action },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: txKeys.all }),
  })
}
