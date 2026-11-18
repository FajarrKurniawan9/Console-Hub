import type { ConsoleSlug, Transaction, TxParticipant } from '../../src/lib/api/schemas'
import { consoleBySlug } from '../data/consoles'
import { logTxAt } from '../data/logs'
import { pad, seeded } from '../data/random'
import { users } from '../data/users'
import { work } from '../data/work'

// 40 past transactions (tx_0001..tx_0040) over 7 days: mostly committed, some aborted
// (stock, PIC overloaded, version conflict), and one needs_attention. Built on top of the
// current work data so ids and names match the lists.

const r = seeded(4040)
const SLUGS: ConsoleSlug[] = ['hr', 'gudang', 'produksi']
const iso = (ms: number) => new Date(ms).toISOString()

type Kind = 'ok' | 'stock' | 'pic' | 'version' | 'stuck'
const OPS: [string, string, () => { id: string; label: string }][] = [
  [
    'pesanan.create',
    'pesanan',
    () => {
      const o = r.pick(work.orders)
      return { id: o.id, label: `Pesanan ${o.order_no}` }
    },
  ],
  [
    'pesanan.complete',
    'pesanan',
    () => {
      const o = r.pick(work.orders)
      return { id: o.id, label: `Pesanan ${o.order_no} diselesaikan` }
    },
  ],
  [
    'karyawan.update',
    'karyawan',
    () => {
      const e = r.pick(work.employees)
      return { id: e.id, label: `Data karyawan ${e.nik}` }
    },
  ],
  [
    'barang.update',
    'barang',
    () => {
      const i = r.pick(work.items)
      return { id: i.id, label: `Barang ${i.sku}` }
    },
  ],
  [
    'karyawan.create',
    'karyawan',
    () => {
      const e = r.pick(work.employees)
      return { id: e.id, label: `Karyawan ${e.nik}` }
    },
  ],
  [
    'divisi.update',
    'divisi',
    () => {
      const d = r.pick(work.divisions)
      return { id: d.id, label: `Divisi ${d.kode}` }
    },
  ],
]

export function seedHistory(): Transaction[] {
  const now = Date.now()
  const times = Array.from({ length: 40 }, () => now - 600_000 - r.next() * 7 * 86_400_000).sort(
    (a, b) => a - b,
  )
  const active = users.filter((u) => u.is_active)
  return times.map((t, i) => {
    const id = `tx_${pad(i + 1, 4)}`
    // Fixed mix: one stuck (#37), aborted every ~5th with rotating reasons.
    const kind: Kind =
      i === 36
        ? 'stuck'
        : i % 5 === 3
          ? (['stock', 'pic', 'version'] as const)[((i / 5) % 3) | 0]!
          : 'ok'
    const [operation, entityType, pick] =
      kind === 'stock' || kind === 'pic' ? OPS[0]! : kind === 'stuck' ? OPS[0]! : r.pick(OPS)
    const entity = pick()
    const user = r.pick(active)
    const prep = (k: number) => t + 300 + k * r.int(200, 900)
    const parts: TxParticipant[] = SLUGS.map((slug, k) => ({
      console: { slug, name: consoleBySlug(slug)!.name },
      prepare_state: 'ok',
      decision_state: 'committed',
      attempts: 2,
      last_error: null,
      prepared_at: iso(prep(k)),
      finished_at: iso(prep(k) + r.int(300, 1400)),
    }))
    const tx: Transaction = {
      id,
      operation,
      entity_type: entityType,
      entity_id: entity.id,
      state: 'committed',
      requested_by: { id: user.id, name: user.name },
      created_at: iso(t),
      decided_at: iso(prep(3)),
      finished_at: iso(prep(3) + 1500),
      failure_code: null,
      failure_message: null,
      participants: parts,
      payload: { entity_id: entity.id },
    }
    const refuse = (slug: ConsoleSlug, code: string, message: string) => {
      tx.state = 'aborted'
      tx.failure_code = code
      tx.failure_message = message
      for (const p of parts) {
        p.decision_state = 'aborted'
        p.attempts = 1
        if (p.console.slug === slug) {
          p.prepare_state = 'refused'
          p.refusal_code = code
          p.refusal_message = message
          p.prepared_at = null
        }
      }
      logTxAt(
        slug,
        'warn',
        `Prepare ${operation} ditolak: ${code}`,
        null,
        id,
        prep(SLUGS.indexOf(slug)),
      )
    }
    if (kind === 'stock') {
      const it = work.items.find((x) => x.sku === 'SKU-BJ-001')!
      const qty = r.int(150, 600)
      refuse(
        'gudang',
        'INSUFFICIENT_STOCK',
        `Pesanan tidak dapat dibuat: stok ${it.nama} tidak cukup (tersedia ${it.stok_tersedia}, dibutuhkan ${qty}).`,
      )
    } else if (kind === 'pic') {
      refuse(
        'hr',
        'PIC_OVERLOADED',
        'Pesanan tidak dapat dibuat: Hendra Gunawan sudah memegang 5 pesanan yang belum selesai. Pilih penanggung jawab lain.',
      )
    } else if (kind === 'version') {
      tx.state = 'aborted'
      tx.failure_code = 'VERSION_CONFLICT'
      tx.failure_message = 'Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.'
      for (const p of parts) {
        p.prepare_state = 'pending'
        p.decision_state = 'aborted'
        p.attempts = 0
        p.prepared_at = null
      }
    } else if (kind === 'stuck') {
      tx.state = 'needs_attention'
      tx.failure_code = 'COMMIT_FAILED'
      tx.failure_message =
        'Commit gagal di Produksi setelah 3 percobaan. Perlu diselesaikan Admin IT.'
      tx.finished_at = null
      const p = parts[2]!
      p.decision_state = 'failed'
      p.attempts = 4
      p.last_error = 'HTTP 503 Service Unavailable saat commit'
      p.finished_at = null
      logTxAt(
        'produksi',
        'error',
        `Commit ${operation} gagal setelah 4 percobaan`,
        null,
        id,
        prep(3) + 4000,
      )
    }
    if (tx.state === 'committed')
      for (const p of parts)
        logTxAt(
          p.console.slug,
          'info',
          `${entity.label} (commit)`,
          user.name.split(' ')[0]!.toLowerCase(),
          id,
          new Date(p.finished_at!).getTime(),
        )
    if (tx.state === 'aborted') tx.finished_at = tx.decided_at
    return tx
  })
}
