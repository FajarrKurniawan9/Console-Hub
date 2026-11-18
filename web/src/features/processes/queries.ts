import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { request } from '../../lib/api'
import { hubProcess, many, one, runStatus } from '../../lib/schemas'
import { runKeys } from '../runs/queries'

export const processKeys = {
  all: ['processes'] as const,
  one: (id: number) => ['processes', id] as const,
}

export function useProcesses() {
  return useQuery({
    queryKey: processKeys.all,
    queryFn: () => request(many(hubProcess), { url: '/processes' }).then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useProcess(id: number) {
  return useQuery({
    queryKey: processKeys.one(id),
    queryFn: () => request(one(hubProcess), { url: `/processes/${id}` }).then((r) => r.data),
    staleTime: 60_000,
  })
}

export const runAccepted = one(z.object({ id: z.string(), status: runStatus }))

export function useStartRun(processId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      request(runAccepted, {
        url: `/processes/${processId}/runs`,
        method: 'POST',
        data: { input },
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: runKeys.all }),
  })
}
