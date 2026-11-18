import { delay, http } from 'msw'
import { consoleById, consoleSeeds, DOWN_ERROR, isDown } from '../data/consoles'
import { recordAudit } from '../data/audit'
import { addLogs, findLog, visibleLogs } from '../data/logs'
import { fail, guard, latency, ok, page, url } from '../http'
import { mockConfig } from '../scenarios'

const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])

export const logHandlers = [
  http.get(url('/admin/logs'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.logs.view')
    if (g.error) return g.error
    const q = new URL(request.url).searchParams
    const consoles = csv(q.get('console_id')).map(Number)
    const levels = csv(q.get('level'))
    const text = q.get('q')?.toLowerCase()
    const from = q.get('from')
    const to = q.get('to')
    const limit = Math.min(Number(q.get('limit') ?? 50), 200)
    // Cursor = id of the last row on the previous page; results go strictly older.
    const cursor = q.get('cursor') ? Number(q.get('cursor')) : null

    const matches = visibleLogs()
      .filter(
        (l) =>
          (!consoles.length || consoles.includes(l.console.id)) &&
          (!levels.length || levels.includes(l.level)) &&
          (!text ||
            l.message.toLowerCase().includes(text) ||
            l.actor?.toLowerCase().includes(text) ||
            l.tx_id?.toLowerCase() === text) &&
          (!from || l.occurred_at >= from) &&
          (!to || l.occurred_at <= to),
      )
      .sort((a, b) => b.id - a.id)
    const start = cursor ? matches.findIndex((l) => l.id < cursor) : 0
    const slice = start < 0 ? [] : matches.slice(start, start + limit)
    const next = start >= 0 && start + limit < matches.length ? String(slice.at(-1)!.id) : null
    return page(
      slice.map(({ raw: _raw, ...rest }) => rest),
      next,
      matches.length,
    )
  }),

  http.get(url('/admin/logs/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'admin.logs.view')
    if (g.error) return g.error
    const log = findLog(Number(params.id))
    if (!log) return fail('NOT_FOUND', `Log #${params.id} tidak ada.`)
    return ok({ data: log })
  }),

  // Contract: 202 with per-console results. The mock pulls synchronously.
  http.post(url('/admin/logs/sync'), async ({ request }) => {
    const g = guard(request, 'admin.logs.view')
    if (g.error) return g.error
    const body = (await request.json().catch(() => ({}))) as { console_id?: number }
    const targets = body.console_id
      ? [consoleById(body.console_id)].filter((c) => !!c)
      : consoleSeeds
    if (!mockConfig.instant) await delay(targets.some((c) => c.slug === 'gudang') ? 1600 : 700)
    const results = targets.map((c) => {
      const ref = { slug: c.slug, name: c.name }
      if (isDown(c.slug))
        return {
          console: ref,
          status: 'failed' as const,
          inserted: null,
          error: `Tidak dapat dihubungi: ${DOWN_ERROR(c)}`,
        }
      const n = 1 + Math.floor(Math.random() * 4)
      addLogs(c.slug, n)
      return { console: ref, status: 'ok' as const, inserted: n, error: null }
    })
    recordAudit(
      g.user,
      'logs.synced',
      { type: null, id: null },
      body.console_id ? (targets[0]?.slug ?? null) : null,
      {
        results: results.map((x) => ({
          console: x.console.slug,
          status: x.status,
          inserted: x.inserted,
        })),
      },
    )
    return ok({ data: results }, 202)
  }),
]
