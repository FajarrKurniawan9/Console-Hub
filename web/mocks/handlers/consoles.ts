import { delay, http } from 'msw'
import { recordAudit } from '../data/audit'
import {
  consoleById,
  consoleSeeds,
  consoleView,
  DOWN_ERROR,
  isDown,
  touchCheck,
} from '../data/consoles'
import { fail, guard, latency, ok, page, url } from '../http'
import { mockConfig } from '../scenarios'

export const consoleHandlers = [
  http.get(url('/admin/consoles'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.consoles.view')
    if (g.error) return g.error
    return page(consoleSeeds.map(consoleView), null, consoleSeeds.length)
  }),

  http.get(url('/admin/consoles/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'admin.consoles.view')
    if (g.error) return g.error
    const seed = consoleById(Number(params.id))
    if (!seed) return fail('NOT_FOUND', `Console #${params.id} tidak ada.`)
    return ok({ data: consoleView(seed) })
  }),

  http.post(url('/admin/consoles/:id/test'), async ({ request, params }) => {
    const g = guard(request, 'admin.consoles.view')
    if (g.error) return g.error
    const seed = consoleById(Number(params.id))
    if (!seed) return fail('NOT_FOUND', `Console #${params.id} tidak ada.`)
    touchCheck(seed.slug)
    const log = (status: string, latency_ms: number | null) =>
      recordAudit(g.user, 'console.tested', { type: 'console', id: seed.slug }, seed.slug, {
        status,
        latency_ms,
      })
    if (isDown(seed.slug)) {
      if (!mockConfig.instant) await delay(1500)
      log('down', null)
      return ok({ data: { status: 'down', latency_ms: null, message: DOWN_ERROR(seed) } })
    }
    const ms = Math.round(seed.latency * (0.8 + Math.random() * 0.4))
    if (!mockConfig.instant) await delay(Math.min(ms, 3000))
    const status = seed.status
    const message =
      status === 'slow'
        ? `Terhubung, tetapi lambat (${ms} ms, batas 2000 ms).`
        : `Terhubung (${ms} ms).`
    log(status, ms)
    return ok({ data: { status, latency_ms: ms, message } })
  }),
]
