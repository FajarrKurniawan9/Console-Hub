import { delay, http } from 'msw'
import type { Transaction, TxState } from '../../src/lib/api/schemas'
import { recordAudit } from '../data/audit'
import { isDown } from '../data/consoles'
import { logTx } from '../data/logs'
import { findTx, transactions } from '../engine/transactions'
import { fail, guard, latency, ok, page, url } from '../http'
import { getScenario, mockConfig } from '../scenarios'

const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])
export const visibleTx = () => (getScenario() === 'empty' ? [] : transactions)

export const txHandlers = [
  http.get(url('/admin/transactions'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.transactions.view')
    if (g.error) return g.error
    const q = new URL(request.url).searchParams
    const states = csv(q.get('state'))
    const op = q.get('operation')
    const limit = Math.min(Number(q.get('limit') ?? 50), 100)
    const offset = Number(q.get('cursor') ?? 0)
    const matches = [...visibleTx()]
      .filter((t) => (!states.length || states.includes(t.state)) && (!op || t.operation === op))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    const slice = matches.slice(offset, offset + limit)
    const next = offset + limit < matches.length ? String(offset + limit) : null
    // The list omits payload; the detail has it.
    return page(
      slice.map(({ payload: _p, ...t }) => structuredClone(t)),
      next,
      matches.length,
    )
  }),

  http.get(url('/admin/transactions/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'admin.transactions.view')
    if (g.error) return g.error
    const tx = findTx(String(params.id))
    if (!tx || getScenario() === 'empty')
      return fail('NOT_FOUND', `Transaksi ${params.id} tidak ada.`)
    return ok({ data: structuredClone(tx) })
  }),

  http.post(url('/admin/transactions/:id/resolve'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'admin.transactions.resolve')
    if (g.error) return g.error
    const tx = findTx(String(params.id))
    if (!tx) return fail('NOT_FOUND', `Transaksi ${params.id} tidak ada.`)
    if (tx.state !== 'needs_attention')
      return fail(
        'CONFLICT',
        `Transaksi ${tx.id} berstatus ${tx.state}; hanya needs_attention yang dapat diselesaikan.`,
      )
    const body = (await request.json().catch(() => ({}))) as { action?: string }
    if (body.action !== 'retry_commit' && body.action !== 'abort')
      return fail('VALIDATION_FAILED', 'Aksi tidak dikenal.', {
        fields: { action: ['Pilih retry_commit atau abort.'] },
      })
    void resolve(tx, body.action)
    recordAudit(g.user, 'transaction.resolved', { type: 'transaction', id: tx.id }, null, {
      tx_id: tx.id,
      action: body.action,
    })
    return ok({ data: { id: tx.id, state: tx.state } }, 202)
  }),
]

/** Runs the chosen resolution in the background; the detail page sees it by polling. */
async function resolve(tx: Transaction, action: 'retry_commit' | 'abort') {
  const step = () => delay(mockConfig.instantTx ? 0 : 500 + Math.random() * 700)
  const failed = tx.participants.filter((p) => p.decision_state === 'failed')
  tx.state = (action === 'retry_commit' ? 'committing' : 'aborting') satisfies TxState
  for (const p of failed) {
    await step()
    p.attempts += 1
    if (isDown(p.console.slug)) {
      p.last_error = 'Console tidak dapat dihubungi saat mencoba ulang'
      continue
    }
    if (action === 'retry_commit') {
      p.decision_state = 'committed'
      p.last_error = null
      logTx(
        p.console.slug,
        'info',
        `Commit ${tx.operation} berhasil setelah dicoba ulang`,
        null,
        tx.id,
      )
    } else {
      p.decision_state = 'aborted'
      logTx(
        p.console.slug,
        'warn',
        `Transaksi ${tx.operation} dibatalkan oleh Admin IT`,
        null,
        tx.id,
      )
    }
    p.finished_at = new Date().toISOString()
  }
  // Abort also compensates the consoles that had already committed.
  if (action === 'abort')
    for (const p of tx.participants.filter((x) => x.decision_state === 'committed')) {
      await step()
      p.decision_state = 'aborted'
      p.finished_at = new Date().toISOString()
    }
  const stillFailing = tx.participants.some((p) => p.decision_state === 'failed')
  tx.state = stillFailing ? 'needs_attention' : action === 'retry_commit' ? 'committed' : 'aborted'
  if (!stillFailing) {
    tx.finished_at = new Date().toISOString()
    if (action === 'abort') tx.failure_message = 'Dibatalkan oleh Admin IT setelah commit gagal.'
    else {
      tx.failure_code = null
      tx.failure_message = null
    }
  }
}
