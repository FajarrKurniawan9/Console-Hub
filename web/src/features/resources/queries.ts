import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { params, request } from '../../lib/api'
import { many, one, record, type DataRecord } from '../../lib/schemas'

export interface ResourceQuery {
  consoleId: number
  key: string
  page: number
  perPage: number
  q: string
}

export const resourceKeys = {
  all: (consoleId: number, key: string) => ['resources', consoleId, key] as const,
  list: (f: ResourceQuery) => ['resources', f.consoleId, f.key, f] as const,
}

export function useResource(f: ResourceQuery) {
  return useQuery({
    queryKey: resourceKeys.list(f),
    queryFn: () =>
      request(many(record), {
        url: `/consoles/${f.consoleId}/resources/${f.key}`,
        params: params({ page: f.page, per_page: f.perPage, q: f.q }),
      }),
    // Keep the last good page while paging or after a console failure.
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useUpdateRecord(consoleId: number, key: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: unknown; fields: Record<string, unknown> }) =>
      request(one(record), {
        url: `/consoles/${consoleId}/resources/${key}/${String(id)}`,
        method: 'PATCH',
        data: { fields },
      }).then((r) => r.data),
    onSuccess: (updated: DataRecord) => {
      // Patch the row in every cached page, then refetch in the background.
      qc.setQueriesData<{ data: DataRecord[] }>(
        { queryKey: resourceKeys.all(consoleId, key) },
        (old) =>
          old ? { ...old, data: old.data.map((r) => (r.id === updated.id ? updated : r)) } : old,
      )
      void qc.invalidateQueries({ queryKey: resourceKeys.all(consoleId, key) })
    },
  })
}
