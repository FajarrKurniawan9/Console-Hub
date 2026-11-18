import { http } from 'msw'
import { TX_STATES, type TxState } from '../../src/lib/api/schemas'
import { latestCheck } from '../data/consistency'
import { consoleSeeds, consoleView } from '../data/consoles'
import { visibleLogs } from '../data/logs'
import { guard, latency, ok, url } from '../http'
import { visibleTx } from './transactions'

export const overviewHandlers = [
  http.get(url('/admin/overview'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.dashboard.view')
    if (g.error) return g.error
    const since = new Date(Date.now() - 86_400_000).toISOString()
    const txs = visibleTx()
    const counts = Object.fromEntries(
      TX_STATES.map((s) => [s, txs.filter((t) => t.state === s).length]),
    ) as Record<TxState, number>
    return ok({
      data: {
        consoles: consoleSeeds.map(consoleView),
        error_logs_24h: visibleLogs().filter((l) => l.level === 'error' && l.occurred_at >= since)
          .length,
        tx_counts: counts,
        recent_transactions: [...txs]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 10)
          .map(({ payload: _p, ...t }) => structuredClone(t)),
        last_consistency: latestCheck(),
      },
    })
  }),
]
