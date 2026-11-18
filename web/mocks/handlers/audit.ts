import { http } from 'msw'
import { audit } from '../data/audit'
import { consoleById } from '../data/consoles'
import { guard, latency, page, url } from '../http'
import { getScenario } from '../scenarios'

export const auditHandlers = [
  http.get(url('/admin/audit'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.audit.view')
    if (g.error) return g.error
    const q = new URL(request.url).searchParams
    const userId = q.get('user_id') ? Number(q.get('user_id')) : null
    const consoleSlug = q.get('console_id') ? consoleById(Number(q.get('console_id')))?.slug : null
    const action = q.get('action')
    const from = q.get('from')
    const to = q.get('to')
    const limit = Math.min(Number(q.get('limit') ?? 50), 100)
    const cursor = q.get('cursor') ? Number(q.get('cursor')) : null
    const matches = (getScenario() === 'empty' ? [] : audit)
      .filter(
        (e) =>
          (userId === null || e.user?.id === userId) &&
          (!consoleSlug || e.console?.slug === consoleSlug) &&
          (!action || e.action === action) &&
          (!from || e.created_at >= from) &&
          (!to || e.created_at <= to),
      )
      .sort((a, b) => b.id - a.id)
    const start = cursor ? matches.findIndex((e) => e.id < cursor) : 0
    const slice = start < 0 ? [] : matches.slice(start, start + limit)
    const next = start >= 0 && start + limit < matches.length ? String(slice.at(-1)!.id) : null
    return page(structuredClone(slice), next, matches.length)
  }),
]
