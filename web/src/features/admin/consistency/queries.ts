import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '../../../lib/api/client'
import {
  consistencyCheck,
  consistencyCheckDetail,
  consistencyFinding,
  many,
  one,
  type ConsistencyCheck,
} from '../../../lib/api/schemas'

export const consistencyKeys = {
  all: ['consistency'] as const,
  list: ['consistency', 'list'] as const,
  one: (id: number) => ['consistency', 'one', id] as const,
}

const running = (c: ConsistencyCheck | undefined) => c?.status === 'running'

export function useChecks() {
  return useQuery({
    queryKey: consistencyKeys.list,
    queryFn: () =>
      request(many(consistencyCheck), { url: '/admin/consistency/checks' }).then((r) => r.data),
    refetchInterval: (q) => (q.state.data?.some(running) ? 2000 : false),
  })
}

/** `alsoPoll`: keep polling (e.g. a repair was sent and has not landed yet). */
export function useCheck(id: number | null, alsoPoll = false) {
  return useQuery({
    queryKey: consistencyKeys.one(id ?? 0),
    queryFn: () =>
      request(one(consistencyCheckDetail), { url: `/admin/consistency/checks/${id}` }).then(
        (r) => r.data,
      ),
    enabled: id !== null,
    refetchInterval: (q) => (running(q.state.data) || alsoPoll ? 2000 : false),
  })
}

export function useRunCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entity_type: ConsistencyCheck['entity_type']) =>
      request(one(consistencyCheck), {
        url: '/admin/consistency/checks',
        method: 'POST',
        data: { entity_type },
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: consistencyKeys.list }),
  })
}

export function useRepair(checkId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (findingId: number) =>
      request(one(consistencyFinding), {
        url: `/admin/consistency/findings/${findingId}/repair`,
        method: 'POST',
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: consistencyKeys.one(checkId) }),
  })
}
