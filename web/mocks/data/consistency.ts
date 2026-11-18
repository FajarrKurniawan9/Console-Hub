import type {
  ConsistencyCheck,
  ConsistencyFinding,
  ConsoleSlug,
  VerifyResult,
} from '../../src/lib/api/schemas'
import { getScenario } from '../scenarios'
import { consoleBySlug, isDown } from './consoles'
import { work } from './work'

// Replicas of Divisi, Karyawan and Barang in the non-owner consoles, and where they drifted.
// A drift disappears when it is repaired or when a committed write touches the row.

export type EntityType = ConsistencyCheck['entity_type']
type Kind = ConsistencyFinding['kind']
interface Drift {
  entity_type: EntityType
  entity_id: string
  console: ConsoleSlug
  kind: Kind
  /** Version the replica holds (null when the row is missing). */
  lag: number | null
}

export const OWNER: Record<EntityType, ConsoleSlug> = {
  divisi: 'hr',
  karyawan: 'hr',
  barang: 'gudang',
}
const SLUGS: ConsoleSlug[] = ['hr', 'gudang', 'produksi']

// Always present: the two findings of check #2 (barang), still unrepaired.
const BASE: Drift[] = [
  {
    entity_type: 'barang',
    entity_id: 'brg-bb-002',
    console: 'produksi',
    kind: 'version_mismatch',
    lag: -1,
  },
  { entity_type: 'barang', entity_id: 'brg-bj-005', console: 'hr', kind: 'missing', lag: null },
]
// `drift` scenario: more drift in the HR-owned data.
const EXTRA: Drift[] = [
  { entity_type: 'karyawan', entity_id: 'kar-004', console: 'gudang', kind: 'missing', lag: null },
  {
    entity_type: 'karyawan',
    entity_id: 'kar-009',
    console: 'produksi',
    kind: 'checksum_mismatch',
    lag: 0,
  },
  {
    entity_type: 'divisi',
    entity_id: 'div-keu',
    console: 'produksi',
    kind: 'version_mismatch',
    lag: -1,
  },
]

const key = (d: Pick<Drift, 'entity_type' | 'entity_id' | 'console'>) =>
  `${d.entity_type}:${d.entity_id}:${d.console}`
let fixed = new Set<string>()

function liveDrifts() {
  return [...BASE, ...(getScenario() === 'drift' ? EXTRA : [])].filter((d) => !fixed.has(key(d)))
}

/** Committed writes bring every replica of the row up to date. */
export function clearDrift(entityType: string, entityId: string | null) {
  if (!entityId) return
  for (const d of [...BASE, ...EXTRA])
    if (d.entity_type === entityType && d.entity_id === entityId) fixed.add(key(d))
}

function rowsOf(type: EntityType): { id: string; version: number; label: string }[] {
  if (type === 'divisi')
    return work.divisions.map((d) => ({
      id: d.id,
      version: d.version,
      label: `${d.kode} ${d.nama}`,
    }))
  if (type === 'karyawan')
    return work.employees.map((e) => ({
      id: e.id,
      version: e.version,
      label: `${e.nik} ${e.name}`,
    }))
  return work.items.map((i) => ({ id: i.id, version: i.version, label: `${i.sku} ${i.nama}` }))
}

/** `?verify=all`: the row's version in each console. */
export function verify(type: EntityType, id: string): VerifyResult | undefined {
  const row = rowsOf(type).find((r) => r.id === id)
  if (!row) return undefined
  const sum = checksum(`${type}:${row.id}:${row.version}:${row.label}`)
  const consoles = SLUGS.map((slug) => {
    const c = { slug, name: consoleBySlug(slug)!.name }
    if (isDown(slug))
      return { console: c, version: null, checksum: null, status: 'unreachable' as const }
    const d = liveDrifts().find(
      (x) => x.entity_type === type && x.entity_id === id && x.console === slug,
    )
    if (!d) return { console: c, version: row.version, checksum: sum, status: 'match' as const }
    const version = d.lag === null ? null : row.version + d.lag
    return {
      console: c,
      version,
      checksum: version === null ? null : checksum(`${type}:${row.id}:${version}:${slug}:stale`),
      status: d.kind,
    }
  })
  return { in_sync: consoles.every((c) => c.status === 'match'), consoles }
}

/** Deterministic hex digest for the mock (two FNV-1a passes). */
function checksum(text: string) {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0
    b = Math.imul(b ^ text.charCodeAt(text.length - 1 - i), 0x811c9dc5) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

// ---- Checks and findings ----

const DAY = 86_400_000
const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()

export let checks: ConsistencyCheck[] = []
export let findings: ConsistencyFinding[] = []
let nextCheck = 4
let nextFinding = 3

function seed() {
  checks = [
    {
      id: 1,
      entity_type: 'divisi',
      status: 'clean',
      checked_count: 4,
      drift_count: 0,
      started_at: at(5 * DAY),
      finished_at: at(5 * DAY - 4000),
    },
    {
      id: 2,
      entity_type: 'barang',
      status: 'drift',
      checked_count: 15,
      drift_count: 2,
      started_at: at(2 * DAY),
      finished_at: at(2 * DAY - 9000),
    },
    {
      id: 3,
      entity_type: 'karyawan',
      status: 'clean',
      checked_count: 12,
      drift_count: 0,
      started_at: at(6 * 3_600_000),
      finished_at: at(6 * 3_600_000 - 7000),
    },
  ]
  findings = BASE.map((d, i) => toFinding(d, 2, i + 1))
  nextCheck = 4
  nextFinding = 3
  fixed = new Set()
}

function toFinding(d: Drift, checkId: number, id: number): ConsistencyFinding {
  const row = rowsOf(d.entity_type).find((r) => r.id === d.entity_id)!
  return {
    id,
    check_id: checkId,
    entity_type: d.entity_type,
    entity_id: d.entity_id,
    label: row.label,
    console: { slug: d.console, name: consoleBySlug(d.console)!.name },
    kind: d.kind,
    owner_version: row.version,
    console_version: d.lag === null ? null : row.version + d.lag,
    repaired_at: null,
  }
}

export function resetConsistency() {
  seed()
}
seed()

export function visibleChecks() {
  return getScenario() === 'empty' ? [] : checks
}

export function latestCheck() {
  return structuredClone(
    [...visibleChecks()].sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null,
  )
}

/** Starts a check; it finishes after `ms`. Returns the running check. */
export function startCheck(type: EntityType, ms: number) {
  const check: ConsistencyCheck = {
    id: nextCheck++,
    entity_type: type,
    status: 'running',
    checked_count: 0,
    drift_count: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
  }
  checks.push(check)
  const finish = () => {
    check.finished_at = new Date().toISOString()
    check.checked_count = rowsOf(type).length
    const replicas = SLUGS.filter((s) => s !== OWNER[type])
    if (isDown(OWNER[type]) || replicas.some(isDown)) {
      check.status = 'failed'
      return
    }
    const found = liveDrifts().filter((d) => d.entity_type === type)
    for (const d of found) findings.push(toFinding(d, check.id, nextFinding++))
    check.drift_count = found.length
    check.status = found.length ? 'drift' : 'clean'
  }
  if (ms <= 0) finish()
  else setTimeout(finish, ms)
  return check
}

/** Copies the owner's row to the lagging console. */
export function repair(f: ConsistencyFinding, ms: number) {
  const done = () => {
    fixed.add(
      key({
        entity_type: f.entity_type as EntityType,
        entity_id: f.entity_id,
        console: f.console.slug as ConsoleSlug,
      }),
    )
    f.repaired_at = new Date().toISOString()
    f.console_version = f.owner_version
  }
  if (ms <= 0) done()
  else setTimeout(done, ms)
}
