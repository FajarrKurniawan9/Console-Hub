import type { AuditEvent } from '../../src/lib/api/schemas'
import { seeded } from './random'
import { users } from './users'

export const audit: AuditEvent[] = []
let nextId = 1

export function recordAudit(
  user: { id: number; name: string } | null,
  action: string,
  target: { type: string | null; id: string | null },
  consoleSlug: string | null,
  details: Record<string, unknown> | null,
  at = new Date().toISOString(),
) {
  audit.push({
    id: nextId++,
    user: user ? { id: user.id, name: user.name } : null,
    action,
    target_type: target.type,
    target_id: target.id,
    console: consoleSlug ? { slug: consoleSlug } : null,
    details,
    created_at: at,
  })
}

// ---- Seeded history: 60 events over 7 days, oldest first so ids ascend with time ----
const r = seeded(777)
const now = Date.now()
const active = users.filter((u) => u.is_active)

type Make = () => Parameters<typeof recordAudit>
const MAKERS: Make[] = [
  () => [
    r.pick(active),
    'barang.update',
    { type: 'item', id: r.pick(['Kain katun', 'Besi beton 10 mm', 'Sarden kaleng 425 g']) },
    'gudang',
    { changes: { quantity: { old: r.int(10, 80), new: r.int(81, 200) } } },
  ],
  () => [
    r.pick(active),
    'produksi.update',
    { type: 'production', id: r.pick(['Area Tekstil A', 'Area Logam B', 'Area Pangan']) },
    'produksi',
    { changes: { courier_id: { old: null, new: 'Dedi Kurniawan' } } },
  ],
  () => [
    users[0]!,
    'personel.create',
    { type: 'person', id: r.pick(['Yusuf Hidayat', 'Lina Marlina']) },
    'hr',
    { name: r.pick(['Yusuf Hidayat', 'Lina Marlina']) },
  ],
  () => {
    const c = r.pick(['hr', 'gudang', 'produksi'])
    const ms = c === 'gudang' ? r.int(2100, 2900) : r.int(100, 400)
    return [
      users[0]!,
      'console.tested',
      { type: 'console', id: c },
      c,
      { status: c === 'gudang' ? 'slow' : 'ok', latency_ms: ms },
    ]
  },
  () => [
    users[0]!,
    'logs.synced',
    { type: null, id: null },
    null,
    {
      results: [
        { console: 'hr', status: 'ok', inserted: r.int(1, 6) },
        { console: 'gudang', status: 'ok', inserted: r.int(0, 4) },
        { console: 'produksi', status: 'ok', inserted: r.int(1, 5) },
      ],
    },
  ],
  () => {
    const u = r.pick(active)
    return [u, 'auth.login', { type: 'user', id: String(u.id) }, null, null]
  },
]

const times = Array.from({ length: 60 }, () => now - r.next() * 7 * 86_400_000).sort(
  (a, b) => a - b,
)
for (const t of times) {
  const args = r.pick(MAKERS)()
  recordAudit(args[0], args[1], args[2], args[3], args[4], new Date(t).toISOString())
}
