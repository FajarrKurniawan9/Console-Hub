// Mesin mock gudang: state di memori, reset saat muat ulang. Semua perubahan stok
// lewat fungsi di sini agar StockLine, Item.stock, Dashboard, dan riwayat selalu serentak.
import type {
  AdjustmentResult,
  AreaAccess,
  Dashboard,
  ItemDetail,
  Item,
  LogEntry,
  MovementType,
  Rack,
  Reservation,
  StockLine,
  StockMovement,
} from '../../lib/api/types'
import { stockLevel } from '../../lib/stock'
import {
  areaAccess,
  INITIAL_STOCK,
  ITEMS,
  LOG_TEMPLATES,
  RACKS,
  SCRIPT,
  STAFF,
  type ItemRec,
  type RackRec,
} from '../fixtures/catalog'
import { pad, seeded } from '../random'
import { invalid, MockFail } from './errors'

type Line = { item_id: string; rack_id: string; on_hand: number; reserved: number }
type ResRec = Reservation & { rack_id: string }

const DAY = 86_400_000

let items: ItemRec[] = []
let racks: RackRec[] = []
let lines: Line[] = []
let movements: StockMovement[] = []
let reservations: ResRec[] = []
let access: AreaAccess[] = []
let logs: LogEntry[] = []
let seq = { movement: 0, log: 0, reservation: 0, rack: 0 }
const idempotency = new Map<string, { fingerprint: string; result: AdjustmentResult }>()

const now = () => new Date().toISOString()

function itemOr404(id: string) {
  const it = items.find((i) => i.id === id)
  if (!it) throw new MockFail('NOT_FOUND', 'Barang tidak ditemukan.')
  return it
}
function rackOr404(id: string) {
  const r = racks.find((x) => x.id === id)
  if (!r) throw new MockFail('NOT_FOUND', 'Rak tidak ditemukan.')
  return r
}
function lineFor(item_id: string, rack_id: string, create = false) {
  let l = lines.find((x) => x.item_id === item_id && x.rack_id === rack_id)
  if (!l && create) {
    l = { item_id, rack_id, on_hand: 0, reserved: 0 }
    lines.push(l)
  }
  return l
}

function log(level: LogEntry['level'], message: string, actor: string | null, at = now()) {
  logs.push({ id: ++seq.log, occurred_at: at, level, message, actor })
}

function record(
  item: ItemRec,
  rack: RackRec,
  type: MovementType,
  quantity: number,
  line: Line,
  extra: { reason?: string; actor?: string; order_code?: string; at?: string } = {},
) {
  const m: StockMovement = {
    id: ++seq.movement,
    occurred_at: extra.at ?? now(),
    item_id: item.id,
    sku: item.sku,
    item_name: item.name,
    rack_id: rack.id,
    rack_code: rack.code,
    type,
    quantity,
    balance_after: line.on_hand,
    reason: extra.reason ?? null,
    actor: extra.actor ?? (extra.order_code ? 'Sistem' : null),
    order_code: extra.order_code ?? null,
  }
  movements.push(m)
  return m
}

// ---- Proyeksi (bentuk kontrak) ----

const toLine = (l: Line): StockLine => {
  const it = itemOr404(l.item_id)
  const r = rackOr404(l.rack_id)
  return {
    item_id: it.id,
    sku: it.sku,
    item_name: it.name,
    unit: it.unit,
    rack_id: r.id,
    rack_code: r.code,
    on_hand: l.on_hand,
    reserved: l.reserved,
    available: l.on_hand - l.reserved,
  }
}

function totals(item_id: string) {
  const ls = lines.filter((l) => l.item_id === item_id)
  const on_hand = ls.reduce((s, l) => s + l.on_hand, 0)
  const reserved = ls.reduce((s, l) => s + l.reserved, 0)
  return { on_hand, reserved, available: on_hand - reserved }
}

const toItem = (it: ItemRec): Item => ({ ...it, stock: totals(it.id) })

const toRack = (r: RackRec): Rack => ({
  ...r,
  item_count: lines.filter((l) => l.rack_id === r.id && l.on_hand > 0).length,
})

const byDesc = <T extends { occurred_at: string; id: number }>(a: T, b: T) =>
  b.occurred_at.localeCompare(a.occurred_at) || b.id - a.id

// ---- Operasi stok ----

function applyAdjust(
  item: ItemRec,
  rack: RackRec,
  mode: 'add' | 'correct',
  quantity: number,
  reason: string,
  actor: string,
  at?: string,
): AdjustmentResult {
  const line = lineFor(item.id, rack.id, true)!
  let delta: number
  if (mode === 'add') {
    delta = quantity
    line.on_hand += quantity
  } else {
    if (quantity < line.reserved)
      throw new MockFail(
        'INSUFFICIENT_STOCK',
        `Jumlah baru (${quantity} ${item.unit}) lebih kecil dari yang sudah direservasi pesanan (${line.reserved} ${item.unit}).`,
        { reserved: line.reserved },
      )
    delta = quantity - line.on_hand
    line.on_hand = quantity
  }
  const movement = record(item, rack, mode === 'add' ? 'adjust_add' : 'adjust_correct', delta, line, {
    reason,
    actor,
    at,
  })
  log(
    'info',
    `${mode === 'add' ? 'Stok ditambah' : 'Stok dikoreksi'}: ${item.sku} ${item.name} di ${rack.code} ${delta >= 0 ? '+' : ''}${delta} ${item.unit} (sekarang ${line.on_hand}). Alasan: ${reason}`,
    actor,
    at,
  )
  return { movement, line: toLine(line) }
}

function reserve(order_code: string, item: ItemRec, rack: RackRec, qty: number, at: string) {
  const line = lineFor(item.id, rack.id)!
  line.reserved += qty
  reservations.push({
    id: `c3000000-0000-4000-8000-${pad(++seq.reservation, 12)}`,
    order_code,
    item_id: item.id,
    sku: item.sku,
    item_name: item.name,
    quantity: qty,
    status: 'aktif',
    created_at: at,
    closed_at: null,
    rack_id: rack.id,
  })
  record(item, rack, 'reserve', -qty, line, { order_code, at })
  log('info', `Reservasi ${qty} ${item.unit} ${item.sku} untuk pesanan ${order_code}.`, 'Sistem', at)
}

function close(order_code: string, how: 'release' | 'consume', at: string) {
  for (const r of reservations.filter((x) => x.order_code === order_code && x.status === 'aktif')) {
    const item = itemOr404(r.item_id)
    const rack = rackOr404(r.rack_id)
    const line = lineFor(r.item_id, r.rack_id)!
    line.reserved -= r.quantity
    if (how === 'consume') line.on_hand -= r.quantity
    r.status = how === 'release' ? 'dilepas' : 'dipakai'
    r.closed_at = at
    // `consume`: stok fisik keluar (on_hand turun); `release`: kembali tersedia.
    record(item, rack, how, how === 'release' ? r.quantity : -r.quantity, line, { order_code, at })
    log(
      'info',
      how === 'release'
        ? `Reservasi pesanan ${order_code} dilepas, ${r.quantity} ${item.unit} ${item.sku} kembali tersedia.`
        : `Barang keluar untuk pesanan ${order_code}: ${r.quantity} ${item.unit} ${item.sku}.`,
      'Sistem',
      at,
    )
  }
}

// ---- Reset / seed ----

export function resetState() {
  const t0 = Date.now()
  const at = (daysAgo: number, hour = 9) => new Date(t0 - daysAgo * DAY + hour * 3_600_000 - 12 * 3_600_000).toISOString()
  items = ITEMS.map((i) => ({ ...i }))
  racks = RACKS.map((r) => ({ ...r }))
  lines = []
  movements = []
  reservations = []
  logs = []
  seq = { movement: 0, log: 0, reservation: 0, rack: racks.length }
  idempotency.clear()
  access = areaAccess(t0)

  const sku = (s: string) => items.find((i) => i.sku === s)!
  const code = (c: string) => racks.find((r) => r.code === c)!

  for (const [s, c, qty] of INITIAL_STOCK) {
    const line = lineFor(sku(s).id, code(c).id, true)!
    line.on_hand = qty
    record(sku(s), code(c), 'initial', qty, line, { reason: 'Saldo awal stok opname', actor: 'Sistem', at: at(30, 7) })
  }
  for (const e of SCRIPT) {
    const when = at(e.at, 10 + (e.at % 6))
    switch (e.kind) {
      case 'add':
      case 'correct':
        applyAdjust(sku(e.sku), code(e.rack), e.kind, e.qty, e.reason, e.actor, when)
        break
      case 'reserve':
        reserve(e.order, sku(e.sku), code(e.rack), e.qty, when)
        break
      default:
        close(e.order, e.kind, when)
    }
  }

  // Log rutin, sampai total sekitar 60 baris.
  const rnd = seeded(7)
  while (logs.length < 60) {
    const [level, message, actor] = rnd.pick(LOG_TEMPLATES)
    const ts = new Date(t0 - rnd.int(5, 14 * 24 * 60) * 60_000).toISOString()
    log(level, message, actor === 'Sistem' ? actor : (actor ?? rnd.pick(STAFF)), ts)
  }
}

// ---- Baca ----

type Filter = Record<string, string | undefined>
const matches = (q: string | undefined, ...fields: Array<string | null>) =>
  !q || fields.some((f) => f?.toLowerCase().includes(q.toLowerCase()))
const inRange = (iso: string, from?: string, to?: string) =>
  (!from || iso >= from) && (!to || iso <= (to.length === 10 ? `${to}T23:59:59.999Z` : to))

export const db = {
  listItems(f: Filter): Item[] {
    return items
      .map(toItem)
      .filter((i) => matches(f.q, i.sku, i.name))
      .filter((i) => !f.kind || i.kind === f.kind)
      .filter((i) => !f.status || i.status === f.status)
      .filter((i) => !f.stock || stockLevel(i.stock.available, i.min_stock) === f.stock)
      .sort((a, b) => a.sku.localeCompare(b.sku))
  },
  getItem(id: string): ItemDetail {
    const it = itemOr404(id)
    return {
      ...toItem(it),
      racks: lines
        .filter((l) => l.item_id === id)
        .map((l) => {
          const r = rackOr404(l.rack_id)
          return {
            rack_id: r.id,
            rack_code: r.code,
            rack_name: r.name,
            on_hand: l.on_hand,
            reserved: l.reserved,
            available: l.on_hand - l.reserved,
          }
        })
        .sort((a, b) => a.rack_code.localeCompare(b.rack_code)),
    }
  },
  listRacks(f: Filter): Rack[] {
    return racks
      .map(toRack)
      .filter((r) => matches(f.q, r.code, r.name, r.location))
      .filter((r) => !f.status || r.status === f.status)
      .sort((a, b) => a.code.localeCompare(b.code))
  },
  getRack: (id: string) => toRack(rackOr404(id)),
  listStock(f: Filter): StockLine[] {
    return lines
      .map(toLine)
      .filter((l) => !f.item_id || l.item_id === f.item_id)
      .filter((l) => !f.rack_id || l.rack_id === f.rack_id)
      .filter((l) => matches(f.q, l.sku, l.item_name, l.rack_code))
      .sort((a, b) => a.sku.localeCompare(b.sku) || a.rack_code.localeCompare(b.rack_code))
  },
  listMovements(f: Filter): StockMovement[] {
    return movements
      .filter((m) => !f.item_id || m.item_id === f.item_id)
      .filter((m) => !f.rack_id || m.rack_id === f.rack_id)
      .filter((m) => !f.type || m.type === f.type)
      .filter((m) => inRange(m.occurred_at, f.from, f.to))
      .sort(byDesc)
  },
  listReservations(f: Filter): Reservation[] {
    return reservations
      .filter((r) => !f.status || r.status === f.status)
      .filter((r) => matches(f.q, r.order_code, r.sku, r.item_name))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ rack_id, ...r }) => (void rack_id, r))
  },
  listAreaAccess(f: Filter): AreaAccess[] {
    return access
      .filter((a) => f.active !== 'true' || a.revoked_at === null)
      .filter((a) => matches(f.q, a.employee_nik, a.employee_name, a.area))
      .sort((a, b) => b.granted_at.localeCompare(a.granted_at))
  },
  listLogs(f: Filter): LogEntry[] {
    return logs
      .filter((l) => !f.level || l.level === f.level)
      .filter((l) => matches(f.q, l.message, l.actor))
      .filter((l) => inRange(l.occurred_at, f.from, f.to))
      .sort(byDesc)
  },
  dashboard(): Dashboard {
    const all = items.map(toItem)
    const low = all.filter((i) => i.status === 'aktif' && stockLevel(i.stock.available, i.min_stock) !== 'ok')
    return {
      counts: {
        items: all.length,
        racks: racks.length,
        active_reservations: reservations.filter((r) => r.status === 'aktif').length,
        low_stock: low.length,
      },
      low_stock: low
        .sort((a, b) => a.stock.available / (a.min_stock || 1) - b.stock.available / (b.min_stock || 1))
        .map((i) => ({
          item_id: i.id,
          sku: i.sku,
          name: i.name,
          unit: i.unit,
          available: i.stock.available,
          min_stock: i.min_stock,
        })),
      recent_movements: [...movements].sort(byDesc).slice(0, 8),
    }
  },
}

// ---- Tulis ----

const CODE_RE = /^[A-Z0-9-]{2,20}$/

function checkCapacity(v: unknown, errs: Record<string, string>) {
  if (v === undefined || v === null) return
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) errs.capacity = 'Kapasitas harus bilangan bulat 0 atau lebih.'
}

export function createRack(body: Record<string, unknown>, actor: string): Rack {
  const errs: Record<string, string> = {}
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const location = typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null
  if (!CODE_RE.test(code)) errs.code = 'Kode 2–20 karakter: huruf, angka, atau tanda hubung.'
  if (name.length < 3) errs.name = 'Nama rak minimal 3 karakter.'
  checkCapacity(body.capacity, errs)
  if (Object.keys(errs).length) throw invalid(errs)
  if (racks.some((r) => r.code === code))
    throw new MockFail('DUPLICATE_CODE', `Kode rak ${code} sudah dipakai.`, { fields: { code: ['Kode ini sudah dipakai rak lain.'] } })
  const n = ++seq.rack
  const r: RackRec = {
    id: `b2000000-0000-4000-8000-${pad(n, 12)}`,
    code,
    name,
    location,
    capacity: (body.capacity as number | null | undefined) ?? null,
    status: 'aktif',
    version: 1,
  }
  racks.push(r)
  log('info', `Rak ${code} (${name}) dibuat.`, actor)
  return toRack(r)
}

export function updateRack(id: string, body: Record<string, unknown>, actor: string): Rack {
  const r = rackOr404(id)
  const errs: Record<string, string> = {}
  if (typeof body.expected_version !== 'number') errs.expected_version = 'Versi rak wajib dikirim.'
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 3))
    errs.name = 'Nama rak minimal 3 karakter.'
  if (body.status !== undefined && body.status !== 'aktif' && body.status !== 'nonaktif')
    errs.status = 'Status tidak dikenal.'
  checkCapacity(body.capacity, errs)
  if (Object.keys(errs).length) throw invalid(errs)
  if (body.expected_version !== r.version)
    throw new MockFail('VERSION_CONFLICT', 'Rak ini baru saja diubah orang lain.', { current_version: r.version })
  if (body.status === 'nonaktif' && r.status === 'aktif' && lines.some((l) => l.rack_id === id && l.on_hand > 0))
    throw new MockFail('RACK_NOT_EMPTY', 'Rak masih berisi stok.')
  if (typeof body.name === 'string') r.name = body.name.trim()
  if (body.location !== undefined)
    r.location = typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null
  if (body.capacity !== undefined) r.capacity = body.capacity as number | null
  if (body.status === 'aktif' || body.status === 'nonaktif') r.status = body.status
  r.version++
  log('info', `Rak ${r.code} diubah.`, actor)
  return toRack(r)
}

export function adjustStock(body: Record<string, unknown>, actor: string, key: string | null): AdjustmentResult {
  const fingerprint = JSON.stringify([body.item_id, body.rack_id, body.mode, body.quantity, body.reason])
  if (key) {
    const prev = idempotency.get(key)
    if (prev) {
      if (prev.fingerprint !== fingerprint)
        throw new MockFail('IDEMPOTENCY_KEY_REUSED', 'Kunci aksi ini sudah dipakai untuk penyesuaian lain.')
      return prev.result
    }
  }
  const errs: Record<string, string> = {}
  const mode = body.mode
  const q = body.quantity
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (typeof body.item_id !== 'string') errs.item_id = 'Pilih barang.'
  if (typeof body.rack_id !== 'string') errs.rack_id = 'Pilih rak.'
  if (mode !== 'add' && mode !== 'correct') errs.mode = 'Pilih jenis penyesuaian.'
  if (typeof q !== 'number' || !Number.isInteger(q)) errs.quantity = 'Jumlah harus bilangan bulat.'
  else if (mode === 'add' && q <= 0) errs.quantity = 'Jumlah tambahan harus lebih dari 0.'
  else if (mode === 'correct' && q < 0) errs.quantity = 'Jumlah tidak boleh negatif.'
  if (reason.length < 5) errs.reason = 'Alasan minimal 5 karakter.'
  if (Object.keys(errs).length) throw invalid(errs)

  const item = itemOr404(body.item_id as string)
  const rack = rackOr404(body.rack_id as string)
  if (item.locked) throw new MockFail('LOCKED', 'Barang ini sedang diproses oleh sistem lain.')
  if (item.status !== 'aktif') throw new MockFail('ITEM_INACTIVE', 'Barang tidak aktif.')
  if (rack.status !== 'aktif') throw new MockFail('RACK_INACTIVE', 'Rak tidak aktif.')
  const current = lineFor(item.id, rack.id)?.on_hand ?? 0
  if (mode === 'correct' && q === current)
    throw invalid({ quantity: 'Jumlah sama dengan stok sekarang, tidak ada yang berubah.' })

  const result = applyAdjust(item, rack, mode as 'add' | 'correct', q as number, reason, actor)
  if (key) idempotency.set(key, { fingerprint, result })
  return result
}

/** Kait tes: ubah status barang (data bersama, di dunia nyata dari portal). */
export function _setItem(id: string, patch: Partial<Pick<ItemRec, 'locked' | 'status'>>) {
  Object.assign(itemOr404(id), patch)
}

resetState()
