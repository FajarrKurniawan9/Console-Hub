import { useQuery } from '@tanstack/react-query'
import { params, request } from '../../lib/api'
import { many, run } from '../../lib/schemas'

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
