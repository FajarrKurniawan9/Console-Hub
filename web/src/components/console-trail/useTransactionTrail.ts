import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { request } from '../../lib/api/client'
import {
  FINAL_TX_STATES,
  one,
  transaction,
  txStatus,
  type ConsoleSlug,
  type Transaction,
  type TxParticipant,
  type TxState,
} from '../../lib/api/schemas'
import type { Tone } from '../../lib/status'

const POLL_MS = 2000
/** After this long without a final state the panel stops polling and offers "Cek lagi". */
export const TRAIL_TIMEOUT_MS = 60_000

// ---- Queries. Admin uses the same key as the Transaksi detail page, so they share the cache. ----

export const trailKeys = {
  admin: (txId: string) => ['transactions', 'one', txId] as const,
  user: (txId: string) => ['transactions', 'status', txId] as const,
}

const isLive = (s: TxState | undefined) => !!s && !FINAL_TX_STATES.includes(s)

/** Polls every 2 s until the state is final or the timeout passes. `restart` polls again. */
function usePolling<T extends { state: TxState }>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  enabled: boolean,
) {
  const [round, setRound] = useState(0)
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setExpired(true), TRAIL_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [round])
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    refetchInterval: (q) => (!expired && isLive(q.state.data?.state) ? POLL_MS : false),
  })
  return {
    query,
    timedOut: expired && isLive(query.data?.state),
    restart: () => {
      setExpired(false)
      setRound((r) => r + 1)
      void query.refetch()
    },
  }
}

/** Admin: full transaction with participants (`admin.transactions.view`). */
export function useAdminTrail(txId: string | null) {
  return usePolling(
    trailKeys.admin(txId ?? ''),
    () => request(one(transaction), { url: `/admin/transactions/${txId}` }).then((r) => r.data),
    !!txId,
  )
}

/** User: only `{ state, message? }` from the owner endpoint. Never calls /admin/*. */
export function useUserTrail(txId: string | null) {
  return usePolling(
    trailKeys.user(txId ?? ''),
    () => request(one(txStatus), { url: `/transactions/${txId}` }).then((r) => r.data),
    !!txId,
  )
}

// ---- The panel slot: one trail per page, shown above the list ----

/** What a finished (or 202) write leaves behind for the panel. */
export interface TrailInput {
  txId: string | null
  /** Version of the saved row, when the response carried the entity. */
  version?: number
  /** Known final failure without a fetch (refused / console down): the API's business sentence. */
  failure?: string
}
export interface Trail extends TrailInput {
  key: number
  path: string
}

export function useTrailState() {
  const { pathname } = useLocation()
  const [trail, setTrail] = useState<Trail | null>(null)
  return {
    // A trail belongs to the page it was made on; navigating away hides it.
    trail: trail?.path === pathname ? trail : null,
    show: (t: TrailInput) => setTrail({ ...t, key: Date.now(), path: pathname }),
    close: () => setTrail(null),
  }
}
export const TrailContext = createContext<ReturnType<typeof useTrailState> | null>(null)
export const useTrailSlot = () => useContext(TrailContext)

// ---- Pure helpers (unit-tested without mocks) ----

export const CONSOLE_ORDER: ConsoleSlug[] = ['hr', 'gudang', 'produksi']

export const byConsoleOrder = (ps: TxParticipant[]) =>
  [...ps].sort(
    (a, b) => CONSOLE_ORDER.indexOf(a.console.slug) - CONSOLE_ORDER.indexOf(b.console.slug),
  )

export type RowStatus =
  'menunggu' | 'siap' | 'menyelesaikan' | 'tersimpan' | 'ditolak' | 'tidak_merespons' | 'dibatalkan'

export const ROW_STATUS: Record<RowStatus, { label: string; tone: Tone }> = {
  menunggu: { label: 'Menunggu', tone: 'muted' },
  siap: { label: 'Siap', tone: 'accent' },
  menyelesaikan: { label: 'Menyelesaikan…', tone: 'accent' },
  tersimpan: { label: 'Tersimpan', tone: 'ok' },
  ditolak: { label: 'Ditolak', tone: 'error' },
  tidak_merespons: { label: 'Tidak merespons', tone: 'error' },
  dibatalkan: { label: 'Dibatalkan', tone: 'muted' },
}

/** One console's row, from its prepare answer, its decision, and the transaction state. */
export function rowStatus(p: TxParticipant, state: TxState): RowStatus {
  if (p.prepare_state === 'refused') return 'ditolak'
  if (p.prepare_state === 'error' || p.decision_state === 'failed') return 'tidak_merespons'
  if (p.decision_state === 'committed') return 'tersimpan'
  if (p.decision_state === 'aborted') return 'dibatalkan'
  if (p.prepare_state === 'pending') return 'menunggu'
  // Prepared, decision still pending.
  return state === 'committing' || state === 'prepared' ? 'menyelesaikan' : 'siap'
}

/** Time from the transaction start to this console's last answer; null when it never answered. */
export function responseMs(p: TxParticipant, tx: Pick<Transaction, 'created_at'>) {
  if (p.prepare_state === 'error') return null
  const end = p.finished_at ?? p.prepared_at
  return end ? Math.max(0, new Date(end).getTime() - new Date(tx.created_at).getTime()) : null
}

/** The one-line summary above the rows. */
export function trailSummary(tx: Transaction) {
  const ps = byConsoleOrder(tx.participants)
  const total = ps.length
  const named = (s: RowStatus) =>
    ps.filter((p) => rowStatus(p, tx.state) === s).map((p) => p.console.name)
  if (tx.state === 'committed') {
    const saved = named('tersimpan').length
    return { tone: 'ok' as Tone, text: `Mengenai ${saved} dari ${total} console` }
  }
  if (tx.state === 'aborted' || tx.state === 'aborting') {
    const refused = ps.filter((p) => p.prepare_state === 'refused')
    if (refused.length)
      return {
        tone: 'error' as Tone,
        text: `Dibatalkan: ${refused.map((p) => `${p.console.name} menolak (${p.refusal_code ?? '?'})`).join(', ')}`,
      }
    const silent = named('tidak_merespons')
    if (silent.length)
      return { tone: 'error' as Tone, text: `Dibatalkan: ${silent.join(', ')} tidak merespons` }
    return {
      tone: 'muted' as Tone,
      text: `Dibatalkan${tx.failure_code ? ` (${tx.failure_code})` : ''}`,
    }
  }
  if (tx.state === 'needs_attention')
    return {
      tone: 'error' as Tone,
      text: `Perlu tindakan: ${named('tidak_merespons').join(', ') || 'satu console'} belum menerapkan`,
    }
  const done = named('tersimpan').length
  return { tone: 'accent' as Tone, text: `Menyelesaikan: ${done} dari ${total} console selesai` }
}

/** User copy. No console names, no codes. */
export function userTrailMessage(
  state: TxState | 'failed',
  reason?: string,
): { tone: Tone; text: string; reason?: string } {
  if (state === 'committed') return { tone: 'ok' as Tone, text: 'Tersimpan di semua sistem.' }
  if (state === 'aborted' || state === 'failed')
    return {
      tone: 'error' as Tone,
      text: 'Belum berhasil disimpan. Tidak ada data yang berubah.',
      reason,
    }
  // The API's message for a stuck write says the same thing; one sentence is enough.
  if (state === 'needs_attention')
    return {
      tone: 'error' as Tone,
      text: 'Perubahan belum selesai di semua sistem. Admin IT sudah diberi tahu.',
    }
  return { tone: 'accent' as Tone, text: 'Sedang diselesaikan…' }
}
