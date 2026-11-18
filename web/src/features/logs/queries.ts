import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { params, request } from '../../lib/api'
import { logEntry, logSyncResult, many, one } from '../../lib/schemas'

export interface LogFilters {
  console_id: string[]
  level: string[]
  q: string
  from: string | null
  to: string | null
}

export const logKeys = {
  all: ['logs'] as const,
  list: (f: LogFilters) => ['logs', 'list', f] as const,
  head: (f: LogFilters) => ['logs', 'head', f] as const,
  one: (id: number) => ['logs', 'one', id] as const,
}

const PAGE = 50

export function useLogs(f: LogFilters) {
  return useInfiniteQuery({
    queryKey: logKeys.list(f),
    queryFn: ({ pageParam }) =>
      request(many(logEntry), {
        url: '/logs',
        params: params({ ...f, limit: PAGE, cursor: pageParam }),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor,
    // The list never refetches on its own: new rows are announced, not injected.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/**
 * Poll the newest matching rows to count how many arrived since the list was loaded.
 * Cheap (limit=50) and does not touch the visible list.
 */
export function useNewLogCount(f: LogFilters, newestId: number | undefined) {
  const q = useQuery({
    queryKey: logKeys.head(f),
    queryFn: () => request(many(logEntry), { url: '/logs', params: params({ ...f, limit: PAGE }) }),
    enabled: newestId !== undefined,
    refetchInterval: 10_000,
  })
  if (newestId === undefined || !q.data) return 0
  return q.data.data.filter((l) => l.id > newestId).length
}

export function useLog(id: number | null) {
  return useQuery({
    queryKey: logKeys.one(id ?? 0),
    queryFn: () => request(one(logEntry), { url: `/logs/${id}` }).then((r) => r.data),
    enabled: id !== null,
  })
}

export function useSyncLogs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (consoleId: number | null) =>
      request(one(logSyncResult), {
        url: '/logs/sync',
        method: 'POST',
        data: consoleId ? { console_id: consoleId } : {},
      }).then((r) => r.data.results),
    // New rows are announced by the head poll; refresh it now instead of waiting.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logs', 'head'] }),
  })
}
