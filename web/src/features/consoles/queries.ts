import { useMutation, useQuery } from '@tanstack/react-query'
import { request } from '../../lib/api'
import { consoleTest, hubConsole, many, one, type HubConsole } from '../../lib/schemas'

export const consoleKeys = {
  all: ['consoles'] as const,
  one: (id: number) => ['consoles', id] as const,
}

export function useConsoles() {
  return useQuery({
    queryKey: consoleKeys.all,
    queryFn: () => request(many(hubConsole), { url: '/consoles' }).then((r) => r.data),
    refetchInterval: 30_000,
  })
}

export function useConsole(id: number) {
  return useQuery({
    queryKey: consoleKeys.one(id),
    queryFn: () => request(one(hubConsole), { url: `/consoles/${id}` }).then((r) => r.data),
  })
}

export function useTestConsole(id: number) {
  return useMutation({
    mutationFn: () =>
      request(one(consoleTest), { url: `/consoles/${id}/test`, method: 'POST' }).then(
        (r) => r.data,
      ),
  })
}

/** slug → display name, from the cached console list (falls back to the slug). */
export function useConsoleName() {
  const { data } = useConsoles()
  return (slug: string) => data?.find((c) => c.slug === slug)?.name
}

export const downSince = (c: HubConsole) => c.down_since ?? c.last_checked_at

/** Down first, then slow, then the rest by name. */
export function sortByAttention(list: HubConsole[]) {
  const rank = { down: 0, slow: 1, unknown: 2, ok: 3 } as const
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name))
}
