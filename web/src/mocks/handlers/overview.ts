import { http } from 'msw'
import { consoleSeeds, consoleView } from '../data/consoles'
import { visibleLogs } from '../data/logs'
import { visibleRuns } from '../data/runs'
import { guard, latency, ok, url } from '../http'

export const overviewHandlers = [
  http.get(url('/overview'), async ({ request }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const since = new Date(Date.now() - 86_400_000).toISOString()
    return ok({
      data: {
        consoles: consoleSeeds.map(consoleView),
        error_logs_24h: visibleLogs().filter((l) => l.level === 'error' && l.occurred_at >= since)
          .length,
        recent_runs: visibleRuns()
          .slice(0, 10)
          .map(({ steps: _steps, ...r }) => structuredClone(r)),
      },
    })
  }),
]
