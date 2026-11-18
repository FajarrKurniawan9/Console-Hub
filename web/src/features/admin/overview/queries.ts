import { useQuery } from '@tanstack/react-query'
import { request } from '../../../lib/api/client'
import { one, overview } from '../../../lib/api/schemas'

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: () => request(one(overview), { url: '/admin/overview' }).then((r) => r.data),
    refetchInterval: 20_000,
  })
}
