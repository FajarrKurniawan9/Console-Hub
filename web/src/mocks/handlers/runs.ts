import { http } from 'msw'
import { visibleRuns } from '../data/runs'
import { guard, latency, page, url } from '../http'

export const runHandlers = [
  http.get(url('/runs'), async ({ request }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const q = new URL(request.url).searchParams
    const procs = q.get('process_id')?.split(',').filter(Boolean).map(Number) ?? []
    const statuses = q.get('status')?.split(',').filter(Boolean) ?? []
    const limit = Math.min(Number(q.get('limit') ?? 25), 100)
    const cursor = q.get('cursor')
    const matches = visibleRuns().filter(
      (r) =>
        (!procs.length || procs.includes(r.process.id)) &&
        (!statuses.length || statuses.includes(r.status)),
    )
    const start = cursor ? matches.findIndex((r) => r.id === cursor) + 1 : 0
    const slice = matches.slice(start, start + limit)
    const next = start + limit < matches.length ? slice.at(-1)!.id : null
    return page(
      slice.map(({ steps: _s, ...r }) => r),
      next,
      matches.length,
    )
  }),
]
