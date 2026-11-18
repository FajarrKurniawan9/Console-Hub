import { useQuery } from '@tanstack/react-query'
import { request } from '../../lib/api'
import { one, overview } from '../../lib/schemas'

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: () => request(one(overview), { url: '/overview' }).then((r) => r.data),
    refetchInterval: 20_000,
  })
}
