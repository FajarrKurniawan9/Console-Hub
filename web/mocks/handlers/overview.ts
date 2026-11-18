import { http } from 'msw'
import { consoleSeeds, consoleView } from '../data/consoles'
import { visibleLogs } from '../data/logs'
import { guard, latency, ok, url } from '../http'

export const overviewHandlers = [
  http.get(url('/admin/overview'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.dashboard.view')
    if (g.error) return g.error
    const since = new Date(Date.now() - 86_400_000).toISOString()
    // Transactions and consistency arrive with the mock engine (phases 2 to 4).
    return ok({
      data: {
        consoles: consoleSeeds.map(consoleView),
        error_logs_24h: visibleLogs().filter((l) => l.level === 'error' && l.occurred_at >= since)
          .length,
        tx_counts: {},
        recent_transactions: [],
        last_consistency: null,
      },
    })
  }),
]
