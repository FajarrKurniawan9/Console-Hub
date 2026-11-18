import { useMutation, useQuery } from '@tanstack/react-query'
import { request } from '../../../lib/api/client'
import { consoleTest, consoleInfo, many, one, type ConsoleInfo } from '../../../lib/api/schemas'

export const consoleKeys = {
  all: ['consoles'] as const,
  one: (id: number) => ['consoles', id] as const,
}

export function useConsoles() {
  return useQuery({
    queryKey: consoleKeys.all,
    queryFn: () => request(many(consoleInfo), { url: '/admin/consoles' }).then((r) => r.data),
    refetchInterval: 30_000,
  })
}

export function useConsole(id: number) {
  return useQuery({
    queryKey: consoleKeys.one(id),
    queryFn: () => request(one(consoleInfo), { url: `/admin/consoles/${id}` }).then((r) => r.data),
  })
}

export function useTestConsole(id: number) {
  return useMutation({
    mutationFn: () =>
      request(one(consoleTest), { url: `/admin/consoles/${id}/test`, method: 'POST' }).then(
        (r) => r.data,
      ),
  })
}

/** The contract has no "down since"; the last check is the best we know. */
export const downSince = (c: ConsoleInfo) => c.last_checked_at

/** Down first, then slow, then the rest by name. */
export function sortByAttention(list: ConsoleInfo[]) {
  const rank = { down: 0, slow: 1, unknown: 2, ok: 3 } as const
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name))
}
