import type {
  ErrorCode,
  Item,
  Person,
  PersonRef,
  Production,
  ProductionRef,
  Source,
  SourceStatus,
  TrackingResult,
  UsedBy,
} from '../../src/lib/api/schemas'
import { consoleBySlug, DOWN_ERROR, isDown, isSlow } from '../data/consoles'
import {
  itemId,
  personId,
  productionId,
  store,
  type StoredItem,
  type StoredProduction,
} from '../data/logistics'
import { getScenario } from '../scenarios'

// The portal hub, mocked: reads merge the three sources, writes check references first
// (kontrak-3-api §5). Handlers turn a thrown HubError into the error envelope.

export class HubError extends Error {
  code: ErrorCode
  details?: Record<string, unknown>
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
  }
}

/** `admin`: the caller holds `admin.consoles.view`, so messages may name sources. */
export type Ctx = { admin: boolean }
export type Kind = 'items' | 'productions' | 'people'
type Body = Record<string, unknown>

export const OWNER: Record<Kind, Source> = {
  items: 'gudang',
  productions: 'produksi',
  people: 'hr',
}
/** Sources merged into each list. */
const JOINS: Record<Kind, Source[]> = { items: ['produksi', 'hr'], productions: ['hr'], people: [] }
const NOUN: Record<Kind, string> = { items: 'Barang', productions: 'Produksi', people: 'Personel' }

function down(source: Source, ctx: Ctx, write: boolean): HubError {
  const c = consoleBySlug(source)
  return new HubError(
    'SOURCE_UNREACHABLE',
    ctx.admin
      ? `API ${c.name} tidak dapat dihubungi: ${DOWN_ERROR(c)}.`
      : write
        ? 'Layanan sedang bermasalah, perubahan data sementara tidak dapat disimpan.'
        : 'Layanan sedang bermasalah, data belum dapat ditampilkan.',
  )
}

// ---------------------------------------------------------------- merge

function personRef(id: string | null): PersonRef | null {
  if (!id || isDown('hr')) return null
  const p = store.people.find((x) => x.id === id)
  return p ? { id: p.id, name: p.name, role: p.role } : null
}

function productionRef(id: string | null): ProductionRef | null {
  if (!id || isDown('produksi')) return null
  const p = store.productions.find((x) => x.id === id)
  return p ? { id: p.id, area: p.area, production_type: p.production_type } : null
}

export const personView = (p: Person): Person => structuredClone(p)
export const productionView = (p: StoredProduction): Production => ({
  ...structuredClone(p),
  courier: personRef(p.courier_id),
})
export const itemView = (i: StoredItem): Item => ({
  ...structuredClone(i),
  production: productionRef(i.production_id),
  responsible: personRef(i.responsible_id),
})

const VIEW = {
  items: itemView,
  productions: productionView,
  people: personView,
} as const

const rowsOf = (kind: Kind): (StoredItem | StoredProduction | Person)[] => store[kind]

/** Does the request touch the slow source (`slow-source`)? */
export const touchesSlow = (kind: Kind | 'tracking') =>
  kind === 'tracking'
    ? (['gudang', 'produksi', 'hr'] as Source[]).some(isSlow)
    : [OWNER[kind], ...JOINS[kind]].some(isSlow)

// ---------------------------------------------------------------- read

export function list(kind: Kind, q: URLSearchParams, ctx: Ctx) {
  if (isDown(OWNER[kind])) throw down(OWNER[kind], ctx, false)
  const term = q.get('q')?.toLowerCase().trim()
  const status = q.get('status') || 'aktif'
  const exact: Record<Kind, string> = {
    items: 'kind',
    productions: 'production_type',
    people: 'role',
  }
  const filter = q.get(exact[kind])?.toLowerCase()
  const limit = Math.min(Math.max(Number(q.get('limit') ?? 25) || 25, 1), 100)
  const offset = Number(q.get('cursor') ?? 0) || 0

  const text = (r: Record<string, unknown>) =>
    kind === 'productions' ? `${r.area} ${r.production_type}` : String(r.name)
  const matches = (getScenario() === 'empty' ? [] : rowsOf(kind))
    .filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!term || text(r).toLowerCase().includes(term)) &&
        (!filter || String((r as Record<string, unknown>)[exact[kind]]).toLowerCase() === filter),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const slice = matches.slice(offset, offset + limit)
  const unavailable = JOINS[kind].filter(isDown)
  return {
    data: slice.map((r) => (VIEW[kind] as (x: typeof r) => Item | Production | Person)(r)),
    meta: {
      next_cursor: offset + limit < matches.length ? String(offset + limit) : null,
      ...(unavailable.length ? { unavailable } : {}),
    },
  }
}

export function getOne(kind: Kind, id: string, ctx: Ctx) {
  if (isDown(OWNER[kind])) throw down(OWNER[kind], ctx, false)
  const row = getScenario() === 'empty' ? undefined : rowsOf(kind).find((r) => r.id === id)
  if (!row) throw new HubError('NOT_FOUND', `${NOUN[kind]} tidak ditemukan.`)
  return (VIEW[kind] as (x: typeof row) => Item | Production | Person)(row)
}

// ---------------------------------------------------------------- validation

type Fields = Record<string, string[]>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function text(f: Fields, b: Body, key: string, label: string, min: number, max: number) {
  const v = str(b[key])
  if (!v) f[key] = [`${label} wajib diisi.`]
  else if (v.length < min || v.length > max)
    f[key] = [`${label} berisi ${min} sampai ${max} karakter.`]
}

/** Validates the keys present (all required keys on create). */
function validate(kind: Kind, b: Body, create: boolean, selfId?: string): Fields {
  const f: Fields = {}
  const has = (k: string) => create || k in b
  if (kind === 'people') {
    if (has('name')) text(f, b, 'name', 'Nama', 2, 120)
    if (has('role')) text(f, b, 'role', 'Role', 2, 60)
  }
  if (kind === 'productions') {
    if (has('area')) text(f, b, 'area', 'Area', 2, 80)
    if (has('production_type')) text(f, b, 'production_type', 'Jenis produksi', 2, 80)
    const self = store.productions.find((p) => p.id === selfId)
    const area = 'area' in b ? str(b.area) : self?.area
    const type = 'production_type' in b ? str(b.production_type) : self?.production_type
    if (
      !f.area &&
      !f.production_type &&
      store.productions.some(
        (p) =>
          p.id !== selfId &&
          p.status === 'aktif' &&
          p.area.toLowerCase() === area?.toLowerCase() &&
          p.production_type.toLowerCase() === type?.toLowerCase(),
      )
    )
      f.production_type = ['Area ini sudah punya produksi dengan jenis yang sama.']
  }
  if (kind === 'items') {
    if (has('name')) text(f, b, 'name', 'Nama', 2, 120)
    if (has('kind')) text(f, b, 'kind', 'Jenis', 2, 60)
    if ('quantity' in b) {
      const q = b.quantity
      if (typeof q !== 'number' || !Number.isInteger(q) || q < 0)
        f.quantity = ['Jumlah berupa bilangan bulat 0 atau lebih.']
    }
    if ('unit' in b && (!str(b.unit) || str(b.unit).length > 20))
      f.unit = ['Satuan wajib diisi, maksimal 20 karakter.']
  }
  if (!create && typeof b.expected_version !== 'number')
    f.expected_version = ['expected_version wajib dikirim.']
  return f
}

const REFS: Record<Kind, { field: string; source: Source; message: string }[]> = {
  items: [
    {
      field: 'production_id',
      source: 'produksi',
      message: 'Produksi yang dipilih tidak ditemukan atau sudah nonaktif.',
    },
    {
      field: 'responsible_id',
      source: 'hr',
      message: 'Personel yang dipilih tidak ditemukan atau sudah nonaktif.',
    },
  ],
  productions: [
    {
      field: 'courier_id',
      source: 'hr',
      message: 'Personel yang dipilih tidak ditemukan atau sudah nonaktif.',
    },
  ],
  people: [],
}

/** Hub §5: every reference must exist and be `aktif` in its source before the owner is called. */
function checkReferences(kind: Kind, b: Body, ctx: Ctx) {
  for (const ref of REFS[kind]) {
    const id = b[ref.field]
    if (id === undefined || id === null || id === '') continue
    if (isDown(ref.source)) throw down(ref.source, ctx, true)
    const rows: { id: string; status: string }[] =
      ref.source === 'hr' ? store.people : store.productions
    const target = rows.find((r) => r.id === id)
    if (!target || target.status !== 'aktif')
      throw new HubError('REFERENCE_NOT_FOUND', ref.message, { fields: [ref.field] })
  }
}

function before(kind: Kind, b: Body, ctx: Ctx, create: boolean, selfId?: string) {
  if (isDown(OWNER[kind])) throw down(OWNER[kind], ctx, true)
  if (getScenario() === 'validation-error') {
    const first = { items: 'name', productions: 'area', people: 'name' }[kind]
    throw new HubError('VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', {
      fields: { [first]: ['Isian ini ditolak oleh server (skenario validation-error).'] },
    })
  }
  const fields = validate(kind, b, create, selfId)
  if (Object.keys(fields).length)
    throw new HubError('VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', { fields })
  checkReferences(kind, b, ctx)
}

const EDITABLE: Record<Kind, string[]> = {
  items: ['name', 'kind', 'production_id', 'responsible_id', 'quantity', 'unit'],
  productions: ['area', 'production_type', 'courier_id'],
  people: ['name', 'role'],
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() || null : v)

// ---------------------------------------------------------------- write

export function create(kind: Kind, b: Body, ctx: Ctx) {
  before(kind, b, ctx, true)
  const now = new Date().toISOString()
  const stamps = { status: 'aktif' as const, version: 1, created_at: now, updated_at: now }
  let row: StoredItem | StoredProduction | Person
  if (kind === 'items') {
    row = {
      id: itemId(store.seq.item++),
      name: str(b.name),
      kind: str(b.kind),
      production_id: (clean(b.production_id) as string | null) ?? null,
      responsible_id: (clean(b.responsible_id) as string | null) ?? null,
      quantity: typeof b.quantity === 'number' ? b.quantity : 0,
      unit: str(b.unit) || 'pcs',
      ...stamps,
    }
    store.items.push(row as StoredItem)
  } else if (kind === 'productions') {
    row = {
      id: productionId(store.seq.production++),
      area: str(b.area),
      production_type: str(b.production_type),
      courier_id: (clean(b.courier_id) as string | null) ?? null,
      ...stamps,
    }
    store.productions.push(row as StoredProduction)
  } else {
    row = { id: personId(store.seq.person++), name: str(b.name), role: str(b.role), ...stamps }
    store.people.push(row as Person)
  }
  return { row, view: (VIEW[kind] as (x: typeof row) => Item | Production | Person)(row) }
}

function findForWrite(kind: Kind, id: string) {
  const row = rowsOf(kind).find((r) => r.id === id)
  if (!row) throw new HubError('NOT_FOUND', `${NOUN[kind]} tidak ditemukan.`)
  return row as Record<string, unknown> & (StoredItem | StoredProduction | Person)
}

function conflict(row: { version: number }, expected: unknown) {
  if (getScenario() === 'conflict' || expected !== row.version)
    throw new HubError(
      'VERSION_CONFLICT',
      'Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.',
      { current_version: row.version },
    )
}

export function update(kind: Kind, id: string, b: Body, ctx: Ctx) {
  if (isDown(OWNER[kind])) throw down(OWNER[kind], ctx, true)
  const row = findForWrite(kind, id)
  before(kind, b, ctx, false, id)
  conflict(row, b.expected_version)
  const changes: Record<string, { old: unknown; new: unknown }> = {}
  for (const k of EDITABLE[kind]) {
    if (!(k in b)) continue
    const next = k.endsWith('_id') ? (clean(b[k]) ?? null) : k === 'quantity' ? b[k] : str(b[k])
    if (JSON.stringify(row[k]) !== JSON.stringify(next)) changes[k] = { old: row[k], new: next }
    row[k] = next
  }
  row.version += 1
  row.updated_at = new Date().toISOString()
  return { row, changes, view: (VIEW[kind] as (x: typeof row) => Item | Production | Person)(row) }
}

/** What still points at a record (active rows only). Needs the referring sources up. */
function usedByOf(kind: Kind, id: string, ctx: Ctx): UsedBy {
  const out: UsedBy = []
  const fromItems = (field: 'production_id' | 'responsible_id') => {
    if (isDown('gudang')) throw down('gudang', ctx, true)
    for (const i of store.items)
      if (i.status === 'aktif' && i[field] === id)
        out.push({ source: 'gudang', type: 'item', id: i.id, name: i.name })
  }
  if (kind === 'people') {
    fromItems('responsible_id')
    if (isDown('produksi')) throw down('produksi', ctx, true)
    for (const p of store.productions)
      if (p.status === 'aktif' && p.courier_id === id)
        out.push({
          source: 'produksi',
          type: 'production',
          id: p.id,
          name: `${p.area} · ${p.production_type}`,
        })
  }
  if (kind === 'productions') fromItems('production_id')
  return out
}

export function deactivate(kind: Kind, id: string, expected: string | null, ctx: Ctx) {
  if (isDown(OWNER[kind])) throw down(OWNER[kind], ctx, true)
  const row = findForWrite(kind, id)
  if (expected === null || expected === '' || !Number.isInteger(Number(expected)))
    throw new HubError('VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', {
      fields: { expected_version: ['expected_version wajib dikirim di query string.'] },
    })
  if (Number(expected) !== row.version) conflict(row, Number(expected))
  let used = usedByOf(kind, id, ctx)
  // `referenced`: every DELETE is refused; show a believable user when nothing really uses it.
  if (getScenario() === 'referenced' && !used.length) {
    const any = store.items.find((i) => i.status === 'aktif' && i.id !== id)
    used = any ? [{ source: 'gudang', type: 'item', id: any.id, name: any.name }] : []
  }
  if (used.length || getScenario() === 'referenced')
    throw new HubError(
      'REFERENCED',
      'Data ini masih dipakai oleh data lain, jadi belum bisa dinonaktifkan.',
      ctx.admin ? { used_by: used } : undefined,
    )
  if (row.status === 'aktif') {
    row.status = 'nonaktif'
    row.version += 1
    row.updated_at = new Date().toISOString()
  }
  return { row, view: (VIEW[kind] as (x: typeof row) => Item | Production | Person)(row) }
}

// ---------------------------------------------------------------- Lacak Barang

const latencyOf = (s: Source) => (isSlow(s) ? 3000 : 40 + Math.floor(Math.random() * 261))

export function track(id: string, ctx: Ctx & { sources: boolean }): TrackingResult {
  if (isDown('gudang')) throw down('gudang', ctx, false)
  const stored = getScenario() === 'empty' ? undefined : store.items.find((i) => i.id === id)
  if (!stored) throw new HubError('NOT_FOUND', 'Barang tidak ditemukan.')
  const item = itemView(stored)
  const warnings: string[] = []
  const sources: SourceStatus[] = [
    { source: 'gudang', status: 'ok', latency_ms: latencyOf('gudang') },
  ]

  let production: Production | null = null
  if (!stored.production_id) {
    sources.push({ source: 'produksi', status: 'ok', latency_ms: null })
  } else if (isDown('produksi')) {
    sources.push({ source: 'produksi', status: 'unavailable', latency_ms: null })
    warnings.push('Data produksi sedang tidak tersedia.')
  } else {
    const p = store.productions.find((x) => x.id === stored.production_id)
    production = p ? productionView(p) : null
    sources.push({
      source: 'produksi',
      status: p ? 'ok' : 'not_found',
      latency_ms: latencyOf('produksi'),
    })
    if (!p) warnings.push('Asal produksi barang ini tidak ditemukan.')
  }

  // The courier id is only known once Produksi answered.
  const courierId = production?.courier_id ?? null
  const wanted = [stored.responsible_id, courierId].filter((x): x is string => !!x)
  let responsible: PersonRef | null = null
  let courier: PersonRef | null = null
  if (!wanted.length) {
    sources.push({ source: 'hr', status: 'ok', latency_ms: null })
  } else if (isDown('hr')) {
    sources.push({ source: 'hr', status: 'unavailable', latency_ms: null })
    warnings.push('Data personel sedang tidak tersedia.')
  } else {
    responsible = personRef(stored.responsible_id)
    courier = personRef(courierId)
    const missing = (stored.responsible_id && !responsible) || (courierId && !courier)
    sources.push({
      source: 'hr',
      status: missing ? 'not_found' : 'ok',
      latency_ms: latencyOf('hr'),
    })
    if (missing) warnings.push('Sebagian data personel tidak ditemukan.')
  }

  return {
    item,
    production,
    responsible,
    courier,
    warnings,
    ...(ctx.sources ? { sources } : {}),
  }
}
