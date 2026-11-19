import { http } from 'msw'
import { audit } from '../data/audit'
import { consoleSeeds, consoleView } from '../data/consoles'
import { visibleLogs } from '../data/logs'
import { guard, latency, ok, url } from '../http'
import { getScenario } from '../scenarios'

export const overviewHandlers = [
  http.get(url('/admin/overview'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.dashboard.view')
    if (g.error) return g.error
    const since = new Date(Date.now() - 86_400_000).toISOString()
    const events = getScenario() === 'empty' ? [] : audit
    return ok({
      data: {
        sources: consoleSeeds.map(consoleView),
        log_errors_24h: visibleLogs().filter((l) => l.level === 'error' && l.occurred_at >= since)
          .length,
        recent_audit: structuredClone([...events].sort((a, b) => b.id - a.id).slice(0, 10)),
      },
    })
  }),
]
