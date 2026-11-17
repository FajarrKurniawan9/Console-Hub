import { http } from 'msw'
import { consoleSeeds, consoleView } from '../data/consoles'
import { guard, latency, ok, url } from '../http'

export const overviewHandlers = [
  http.get(url('/overview'), async ({ request }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    // Logs and runs arrive in phases 2 and 4.
    return ok({
      data: { consoles: consoleSeeds.map(consoleView), error_logs_24h: 0, recent_runs: [] },
    })
  }),
]
