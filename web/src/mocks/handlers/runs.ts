import { http } from 'msw'
import { recordAudit } from '../data/audit'
import { findProcess } from '../data/processes'
import { cancelRun, findRun, isFinal, startRun, visibleRuns } from '../data/runs'
import { fail, guard, latency, ok, page, url } from '../http'
import { RUN_STATUS } from '../../lib/status'
import { canCancel, retryMode } from '../../lib/runs'

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
      slice.map(({ steps: _s, ...r }) => structuredClone(r)),
      next,
      matches.length,
    )
  }),

  http.get(url('/runs/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const run = findRun(String(params.id))
    if (!run) return fail('NOT_FOUND', `Eksekusi ${params.id} tidak ada.`)
    // Clone: the engine keeps mutating the original.
    return ok({ data: structuredClone(run) })
  }),

  http.post(url('/runs/:id/cancel'), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const run = findRun(String(params.id))
    if (!run) return fail('NOT_FOUND', `Eksekusi ${params.id} tidak ada.`)
    if (!canCancel(run))
      return fail(
        'CONFLICT',
        `Eksekusi berstatus "${RUN_STATUS[run.status].label}" tidak dapat dibatalkan.`,
        {
          details: { status: run.status },
        },
      )
    cancelRun(run)
    recordAudit(g.user, 'run.canceled', { type: 'run', id: run.id }, null, {
      process: run.process.name,
    })
    return ok({ data: structuredClone(run) })
  }),

  http.post(url('/runs/:id/retry'), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const run = findRun(String(params.id))
    if (!run) return fail('NOT_FOUND', `Eksekusi ${params.id} tidak ada.`)
    if (!isFinal(run) || !retryMode(run))
      return fail(
        'CONFLICT',
        `Hanya eksekusi gagal yang dapat diulang (status sekarang "${RUN_STATUS[run.status].label}").`,
        {
          details: { status: run.status },
        },
      )
    const proc = findProcess(run.process.id)!
    const next = startRun(proc, run.input, { id: g.user.id, name: g.user.name }, run)
    recordAudit(g.user, 'run.retried', { type: 'run', id: next.id }, null, {
      process: proc.name,
      retry_of: run.id,
      mode: retryMode(run),
    })
    return ok({ data: { id: next.id, status: next.status } }, 202)
  }),
]
