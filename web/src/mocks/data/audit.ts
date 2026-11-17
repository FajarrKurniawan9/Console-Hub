import type { AuditEvent } from '../../lib/schemas'
import { pad, seeded } from './random'
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
const PRICE = [98_000, 125_000, 142_500, 87_000, 115_000, 156_000]

type Make = () => Parameters<typeof recordAudit>
const MAKERS: Make[] = [
  () => {
    const i = r.int(0, 5)
    const old = PRICE[i]!
    return [
      r.pick(users),
      'resource.updated',
      { type: 'prices', id: `SKU-BJ-${pad(i + 1)}` },
      'produksi',
      { resource: 'prices', changes: { price_idr: { old: old - 10_000, new: old } } },
    ]
  },
  () => {
    const i = r.int(1, 8)
    return [
      r.pick(users),
      'resource.updated',
      { type: 'items', id: `SKU-BB-${pad(i)}` },
      'gudang',
      { resource: 'items', changes: { min_stock: { old: 40, new: r.pick([50, 60, 80]) } } },
    ]
  },
  () => [
    r.pick(users),
    'resource.updated',
    { type: 'employees', id: `E-${pad(r.int(1, 12))}` },
    'hr',
    { resource: 'employees', changes: { status: { old: 'aktif', new: 'nonaktif' } } },
  ],
  () => [
    r.pick(users),
    'run.started',
    { type: 'run', id: `run_2026111${r.int(1, 6)}_${pad(r.int(1, 20), 4)}` },
    null,
    {
      process: 'Pesanan produksi baru',
      input: { customer: 'CV Sumber Rezeki', sku: 'SKU-BJ-003', qty: r.int(10, 90) },
    },
  ],
  () => [
    r.pick(users),
    'run.retried',
    { type: 'run', id: `run_2026111${r.int(1, 6)}_${pad(r.int(1, 20), 4)}` },
    null,
    {
      process: 'Onboarding karyawan baru',
      retry_of: `run_2026111${r.int(1, 6)}_${pad(r.int(1, 20), 4)}`,
      mode: 'from_failed',
    },
  ],
  () => [
    r.pick(users),
    'run.canceled',
    { type: 'run', id: `run_2026111${r.int(1, 6)}_${pad(r.int(1, 20), 4)}` },
    null,
    { process: 'Pesanan produksi baru' },
  ],
  () => {
    const c = r.pick(['hr', 'gudang', 'produksi'])
    const ms = c === 'gudang' ? r.int(2100, 2900) : r.int(100, 400)
    return [
      r.pick(users),
      'console.tested',
      { type: 'console', id: c },
      c,
      { status: c === 'gudang' ? 'slow' : 'ok', latency_ms: ms },
    ]
  },
  () => [
    r.pick(users),
    'logs.synced',
    { type: null, id: null },
    null,
    {
      results: [
        { console: 'hr', ok: true, fetched: r.int(1, 6) },
        { console: 'gudang', ok: true, fetched: r.int(0, 4) },
        { console: 'produksi', ok: true, fetched: r.int(1, 5) },
      ],
    },
  ],
  () => {
    const u = r.pick(users)
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
