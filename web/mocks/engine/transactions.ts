import { delay, type HttpResponse } from 'msw'
import type { ConsoleSlug, Refusal, Transaction, TxParticipant } from '../../src/lib/api/schemas'
import { recordAudit } from '../data/audit'
import { consoleBySlug, consoleSeeds, DOWN_ERROR, isDown } from '../data/consoles'
import { logTx } from '../data/logs'
import { pad } from '../data/random'
import { can, type MockUser } from '../data/users'
import { fail, ok } from '../http'
import { getScenario, mockConfig } from '../scenarios'

// Simulated two-phase commit over the three consoles (brief v3 §9, "Mesin transaksi mock").
// Every write: preparing → each console prepares (0.3–1.5 s) → commit or abort → finished.

export const transactions: Transaction[] = []
let seq = 41 // tx_0001..0040 are the seeded history (phase 3).
export const nextTxId = () => `tx_${pad(seq++, 4)}`

const SLUGS: ConsoleSlug[] = ['hr', 'gudang', 'produksi']
const FINAL = ['committed', 'aborted'] as const
const now = () => new Date().toISOString()
const wait = (min = 300, max = 1500) =>
  delay(mockConfig.instantTx ? 0 : min + Math.random() * (max - min))

/** A row held by a transaction that has not finished (needs_attention still holds it). */
export function isLocked(entityType: string, entityId: string) {
  return transactions.some(
    (t) =>
      t.entity_type === entityType &&
      t.entity_id === entityId &&
      !FINAL.includes(t.state as (typeof FINAL)[number]),
  )
}

/** A console's refusal; `message` is a business sentence safe to show to User. */
export type ConsoleRefusal = { console: ConsoleSlug; code: string; message: string }

export interface WriteSpec<E> {
  user: MockUser
  operation: string
  entityType: string
  entityId: string | null
  payload: unknown
  /** For updates: the version the client saw vs. the current one. */
  version?: { expected: number | undefined; current: number }
  /** Evaluated before prepare: what each console would refuse. */
  refusals: () => ConsoleRefusal[]
  /** Runs at the commit decision; mutates the mock data and returns the entity. */
  apply: () => E
  /** Audit details and log line once committed. */
  describe: (entity: E) => {
    label: string
    changes?: Record<string, { old: unknown; new: unknown }>
  }
  status?: 200 | 201
}

function participant(slug: ConsoleSlug): TxParticipant {
  return {
    console: { slug, name: consoleBySlug(slug)!.name },
    prepare_state: 'pending',
    decision_state: 'pending',
    attempts: 0,
    last_error: null,
    prepared_at: null,
    finished_at: null,
  }
}

const technical = (u: MockUser) => can(u, 'admin.transactions.view')

export async function runWrite<E>(spec: WriteSpec<E>): Promise<Response> {
  const { user } = spec
  if (spec.entityId && isLocked(spec.entityType, spec.entityId))
    return fail(
      'LOCKED',
      'Data ini sedang diproses perubahan lain. Tunggu sebentar, muat ulang, lalu coba lagi.',
    )

  const tx: Transaction = {
    id: nextTxId(),
    operation: spec.operation,
    entity_type: spec.entityType,
    entity_id: spec.entityId,
    state: 'preparing',
    requested_by: { id: user.id, name: user.name },
    created_at: now(),
    decided_at: null,
    finished_at: null,
    failure_code: null,
    failure_message: null,
    participants: SLUGS.map(participant),
    payload: spec.payload,
  }
  transactions.push(tx)

  const abort = (code: string, message: string) => {
    tx.state = 'aborted'
    tx.decided_at = tx.finished_at = now()
    tx.failure_code = code
    tx.failure_message = message
    for (const p of tx.participants) {
      p.decision_state = 'aborted'
      p.finished_at = now()
    }
  }

  if (spec.version && spec.version.expected !== spec.version.current) {
    const msg = 'Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.'
    abort('VERSION_CONFLICT', msg)
    return fail('VERSION_CONFLICT', msg, {
      details: { current_version: spec.version.current, tx_id: tx.id },
    })
  }

  // ---- Phase 1: prepare ----
  const refusals = spec.refusals()
  await Promise.all(
    tx.participants.map(async (p) => {
      await wait()
      p.attempts = 1
      const slug = p.console.slug
      if (isDown(slug)) {
        p.prepare_state = 'error'
        p.last_error = DOWN_ERROR(consoleBySlug(slug)!)
        return
      }
      const r = refusals.find((x) => x.console === slug)
      if (r) {
        p.prepare_state = 'refused'
        p.refusal_code = r.code
        p.refusal_message = r.message
        logTx(slug, 'warn', `Prepare ${tx.operation} ditolak: ${r.code}`, null, tx.id)
        return
      }
      p.prepare_state = 'ok'
      p.prepared_at = now()
    }),
  )

  const down = tx.participants.filter((p) => p.prepare_state === 'error')
  if (down.length) {
    const names = down.map((p) => p.console.name).join(', ')
    tx.state = 'aborting'
    await wait(100, 400)
    abort('CONSOLE_UNREACHABLE', `Console ${names} tidak dapat dihubungi.`)
    return fail(
      'CONSOLE_UNREACHABLE',
      technical(user)
        ? `Console ${names} tidak dapat dihubungi (${down[0]!.last_error}). Transaksi ${tx.id} dibatalkan; tidak ada data yang berubah.`
        : 'Layanan sedang bermasalah. Tidak ada data yang berubah; coba lagi beberapa menit lagi.',
      technical(user) ? { details: { tx_id: tx.id } } : {},
    )
  }

  if (refusals.length) {
    const message = refusals.map((r) => r.message).join(' ')
    tx.state = 'aborting'
    await wait(100, 400)
    abort(refusals[0]!.code, message)
    const list: Refusal[] = refusals.map((r) => ({
      console: consoleBySlug(r.console)!.name,
      code: r.code,
      message: r.message,
    }))
    return fail(
      'TRANSACTION_REFUSED',
      message,
      technical(user) ? { details: { tx_id: tx.id, refusals: list } } : {},
    )
  }

  // ---- Decision: commit ----
  tx.state = 'prepared'
  tx.decided_at = now()
  const entity = spec.apply()
  tx.state = 'committing'
  const info = spec.describe(entity)
  if (!tx.entity_id) tx.entity_id = (entity as { id?: string }).id ?? null

  const stuck = getScenario() === 'commit-stuck'
  const commit = async () => {
    await Promise.all(
      tx.participants.map(async (p) => {
        await wait(getScenario() === 'slow' ? 1500 : 300, getScenario() === 'slow' ? 4000 : 1500)
        // commit-stuck: Produksi keeps failing its commit until the portal gives up.
        if (stuck && p.console.slug === 'produksi') {
          for (let i = 0; i < 3; i++) {
            p.attempts += 1
            p.last_error = 'HTTP 503 Service Unavailable saat commit'
            await wait(400, 900)
          }
          p.decision_state = 'failed'
          logTx(
            'produksi',
            'error',
            `Commit ${tx.operation} gagal setelah ${p.attempts} percobaan`,
            null,
            tx.id,
          )
          return
        }
        p.attempts += 1
        p.decision_state = 'committed'
        p.finished_at = now()
        logTx(
          p.console.slug,
          'info',
          `${info.label} (commit)`,
          user.name.split(' ')[0]!.toLowerCase(),
          tx.id,
        )
      }),
    )
    if (tx.participants.some((p) => p.decision_state === 'failed')) {
      tx.state = 'needs_attention'
      tx.failure_code = 'COMMIT_FAILED'
      tx.failure_message =
        'Commit gagal di Produksi setelah 3 percobaan. Perlu diselesaikan Admin IT.'
    } else {
      tx.state = 'committed'
    }
    tx.finished_at = now()
  }

  recordAudit(user, spec.operation, { type: spec.entityType, id: tx.entity_id }, null, {
    tx_id: tx.id,
    ...(info.changes ? { changes: info.changes } : {}),
  })

  // `slow` and `commit-stuck`: the decision is made but not finished everywhere → 202.
  if (stuck || getScenario() === 'slow') {
    void commit()
    return ok({ data: { transaction: { id: tx.id, state: tx.state }, entity } }, 202)
  }
  await commit()
  return ok({ data: { transaction: { id: tx.id, state: tx.state }, entity } }, spec.status ?? 200)
}

/** What the requester of a 202 may see: state plus a business sentence. */
export function txStatusView(tx: Transaction) {
  const message =
    tx.state === 'aborted'
      ? (tx.failure_message ?? undefined)
      : tx.state === 'needs_attention'
        ? 'Perubahan sudah dicatat, tetapi belum selesai di semua bagian sistem. Admin IT sudah diberi tahu dan akan menyelesaikannya.'
        : undefined
  return { id: tx.id, state: tx.state, ...(message ? { message } : {}) }
}

export const findTx = (id: string) => transactions.find((t) => t.id === id)
export const allConsoles = consoleSeeds
export type { HttpResponse }
