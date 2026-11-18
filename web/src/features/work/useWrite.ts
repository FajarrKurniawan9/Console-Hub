import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, newIdempotencyKey, toApiError } from '../../lib/api/client'
import { CONSOLE_CODES } from '../../lib/errors'
import type { Refusal } from '../../lib/api/schemas'
import { sendWrite, type WriteCall } from '../../lib/api/work'
import { useIsAdminView } from '../../lib/permissions'
import { useTrailSlot } from '../../components/console-trail/useTransactionTrail'

/** What the screen shows after a write. Exactly one of these at a time. */
export type WriteOutcome =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'refused'; message: string; refusals: Refusal[]; txId?: string }
  | { kind: 'conflict'; message: string }
  | { kind: 'error'; error: ApiError }

export interface WriteOptions {
  /** Toast text on success, e.g. "Karyawan disimpan". */
  success: string
  /** Query keys to refresh once the write is final. */
  invalidate: readonly (readonly unknown[])[]
  onDone?: () => void
}

const REFUSALS = (e: ApiError): Refusal[] => {
  const r = e.details?.refusals
  return Array.isArray(r) ? (r as Refusal[]) : []
}

/**
 * Brief 8.2 "Perilaku menyimpan", shared by every work screen:
 * - one Idempotency-Key per intent, reused when the user retries that intent;
 * - success or 202 → toast, refresh, close; the "Jejak 3 console" panel shows the result and,
 *   on 202, polls every 2 s until final;
 * - VERSION_CONFLICT / LOCKED → reload dialog; TRANSACTION_REFUSED → reason (Admin: per console);
 * - nothing is marked as done before a success response.
 */
export function useWrite() {
  const qc = useQueryClient()
  const admin = useIsAdminView()
  const trail = useTrailSlot()
  const [outcome, setOutcome] = useState<WriteOutcome>({ kind: 'idle' })
  // Same intent (same call body) keeps its key across retries.
  const intent = useRef<{ sig: string; key: string } | null>(null)

  const refresh = (o: WriteOptions) =>
    Promise.all(o.invalidate.map((queryKey) => qc.invalidateQueries({ queryKey })))

  async function run(call: WriteCall, o: WriteOptions) {
    const sig = JSON.stringify(call)
    if (intent.current?.sig !== sig) intent.current = { sig, key: newIdempotencyKey() }
    setOutcome({ kind: 'saving' })
    try {
      const res = await sendWrite(call, intent.current.key)
      const version = (res.entity as { version?: unknown } | undefined)?.version
      // "Jejak 3 console" above the list. On 202 it also follows the transaction to its end,
      // so the form can close now instead of holding the user until every console is done.
      trail?.show({
        txId: res.transaction.id,
        version: typeof version === 'number' ? version : undefined,
      })
      intent.current = null
      await refresh(o)
      setOutcome({ kind: 'idle' })
      toast.success(
        res.transaction.state === 'committed' ? o.success : `${o.success}: sedang diselesaikan`,
      )
      o.onDone?.()
      return true
    } catch (err) {
      const e = toApiError(err)
      // Refused, conflict and validation are final answers: a new attempt is a new intent.
      if (e.status >= 400 && e.status < 500 && e.code !== 'RATE_LIMITED') intent.current = null
      // Refused or console down: the trail shows which consoles answered what.
      if (e.code === 'TRANSACTION_REFUSED' || CONSOLE_CODES.includes(e.code)) {
        const txId = typeof e.details?.tx_id === 'string' ? e.details.tx_id : null
        trail?.show({ txId, failure: e.message })
      }
      if (e.code === 'TRANSACTION_REFUSED') {
        setOutcome({
          kind: 'refused',
          message: e.message,
          refusals: admin ? REFUSALS(e) : [],
          txId: admin && typeof e.details?.tx_id === 'string' ? e.details.tx_id : undefined,
        })
      } else if (e.code === 'VERSION_CONFLICT' || e.code === 'LOCKED' || e.code === 'CONFLICT') {
        setOutcome({
          kind: 'conflict',
          message:
            'Data ini baru saja diubah orang lain atau sedang diproses. Muat ulang lalu coba lagi.',
        })
      } else {
        setOutcome({ kind: 'error', error: e })
      }
      return false
    }
  }

  return {
    outcome,
    run,
    busy: outcome.kind === 'saving',
    reset: () => setOutcome({ kind: 'idle' }),
  }
}
