import { http, type HttpResponseResolver } from 'msw'
import type {
  ConsoleSlug,
  Division,
  Employee,
  Item,
  Order,
  Permission,
} from '../../src/lib/api/schemas'
import { consoleBySlug, DOWN_ERROR, isDown } from '../data/consoles'
import { can, type MockUser } from '../data/users'
import { openOrdersOf, pad, work } from '../data/work'
import { verify, type EntityType } from '../data/consistency'
import { findTx, runWrite, txStatusView, type ConsoleRefusal } from '../engine/transactions'
import { fail, guard, latency, ok, page, url } from '../http'
import { getScenario } from '../scenarios'

type Fields = Record<string, string[]>
const rp = (n: number) => `Rp${n.toLocaleString('id-ID')}`
const body = async (r: Request) => (await r.json().catch(() => ({}))) as Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN)

/** Reads come from the owner console; if it is down the read fails like the real portal. */
function ownerDown(user: MockUser, owner: ConsoleSlug) {
  if (!isDown(owner)) return null
  const c = consoleBySlug(owner)!
  return fail(
    'CONSOLE_UNREACHABLE',
    can(user, 'admin.consoles.view')
      ? `Console ${c.name} tidak dapat dihubungi: ${DOWN_ERROR(c)}.`
      : 'Layanan sedang bermasalah, data belum dapat ditampilkan. Coba lagi beberapa menit lagi.',
  )
}

function invalid(fields: Fields) {
  return fail('VALIDATION_FAILED', 'Periksa kembali isian yang ditandai.', { fields })
}

/** `validation-error` scenario: every write returns 422 on its first field. */
function scenario422(first: string) {
  return getScenario() === 'validation-error'
    ? invalid({ [first]: ['Isian ini ditolak oleh server (skenario validation-error).'] })
    : null
}

function list<T extends { id: string; status: string }>(
  request: Request,
  rows: T[],
  text: (row: T) => string,
) {
  const q = new URL(request.url).searchParams
  const term = q.get('q')?.toLowerCase().trim()
  const status = q.get('status')
  const limit = Math.min(Number(q.get('limit') ?? 50), 200)
  const offset = Number(q.get('cursor') ?? 0)
  const matches = (getScenario() === 'empty' ? [] : rows).filter(
    (r) => (!term || text(r).toLowerCase().includes(term)) && (!status || r.status === status),
  )
  const slice = matches.slice(offset, offset + limit)
  const next = offset + limit < matches.length ? String(offset + limit) : null
  return page(structuredClone(slice), next, matches.length)
}

/** GET list + GET one, read from the owner console. */
function readHandlers<T extends { id: string; status: string }>(
  path: string,
  perm: Permission,
  owner: ConsoleSlug,
  rows: () => T[],
  text: (row: T) => string,
  notFound: string,
  verifyType?: EntityType,
) {
  const one: HttpResponseResolver = async ({ request, params }) => {
    await latency()
    const g = guard(request, perm)
    if (g.error) return g.error
    const down = ownerDown(g.user, owner)
    if (down) return down
    const row = rows().find((r) => r.id === params.id)
    if (!row || getScenario() === 'empty') return fail('NOT_FOUND', notFound)
    const wantVerify = new URL(request.url).searchParams.get('verify') === 'all'
    const consistency =
      wantVerify && verifyType && can(g.user, 'admin.consistency.view')
        ? verify(verifyType, row.id)
        : undefined
    return ok({ data: { ...structuredClone(row), ...(consistency ? { consistency } : {}) } })
  }
  return [
    http.get(url(path), async ({ request }) => {
      await latency()
      const g = guard(request, perm)
      if (g.error) return g.error
      return ownerDown(g.user, owner) ?? list(request, rows(), text)
    }),
    http.get(url(`${path}/:id`), one),
  ]
}

const diff = <T extends object>(before: T, after: T, keys: (keyof T)[]) =>
  Object.fromEntries(
    keys
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => [k, { old: before[k], new: after[k] }]),
  )

// ------------------------------------------------------------------ Divisi

function divisionFields(b: Record<string, unknown>, partial: boolean): Fields {
  const f: Fields = {}
  if (!partial || 'kode' in b) {
    const kode = str(b.kode).toUpperCase()
    if (!kode) f.kode = ['Kode divisi wajib diisi.']
    else if (!/^[A-Z]{2,5}$/.test(kode)) f.kode = ['Kode berisi 2 sampai 5 huruf, mis. HRD.']
    else if (work.divisions.some((d) => d.kode === kode && d.id !== b.__id))
      f.kode = [`Kode ${kode} sudah dipakai divisi lain.`]
  }
  if ((!partial || 'nama' in b) && !str(b.nama)) f.nama = ['Nama divisi wajib diisi.']
  return f
}

const divisionHandlers = [
  ...readHandlers(
    '/divisions',
    'divisi.view',
    'hr',
    () => work.divisions,
    (d) => `${d.kode} ${d.nama}`,
    'Divisi tidak ditemukan.',
    'divisi',
  ),

  http.post(url('/divisions'), async ({ request }) => {
    await latency()
    const g = guard(request, 'divisi.create')
    if (g.error) return g.error
    const b = await body(request)
    const f = divisionFields(b, false)
    if (Object.keys(f).length) return invalid(f)
    const v = scenario422('kode')
    if (v) return v
    return runWrite<Division>({
      user: g.user,
      operation: 'divisi.create',
      entityType: 'divisi',
      entityId: null,
      payload: b,
      refusals: () => [],
      apply: () => {
        const d: Division = {
          id: `div-${str(b.kode).toLowerCase()}`,
          kode: str(b.kode).toUpperCase(),
          nama: str(b.nama),
          status: 'aktif',
          version: 1,
        }
        work.divisions.push(d)
        work.seq.division++
        return structuredClone(d)
      },
      describe: (d) => ({ label: `Divisi ${d.kode} dibuat` }),
      status: 201,
    })
  }),

  http.patch(url('/divisions/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'divisi.update')
    if (g.error) return g.error
    const d = work.divisions.find((x) => x.id === params.id)
    if (!d) return fail('NOT_FOUND', 'Divisi tidak ditemukan.')
    const b = await body(request)
    const f = divisionFields({ ...b, __id: d.id }, true)
    if (Object.keys(f).length) return invalid(f)
    const v = scenario422('nama')
    if (v) return v
    const before = structuredClone(d)
    return runWrite<Division>({
      user: g.user,
      operation: 'divisi.update',
      entityType: 'divisi',
      entityId: d.id,
      payload: b,
      version: { expected: num(b.expected_version), current: d.version },
      refusals: () => [],
      apply: () => {
        if ('kode' in b) d.kode = str(b.kode).toUpperCase()
        if ('nama' in b) d.nama = str(b.nama)
        d.version++
        for (const e of work.employees) if (e.division.id === d.id) e.division.nama = d.nama
        return structuredClone(d)
      },
      describe: (after) => ({
        label: `Divisi ${after.kode} diubah`,
        changes: diff(before, after, ['kode', 'nama']),
      }),
    })
  }),

  http.delete(url('/divisions/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'divisi.delete')
    if (g.error) return g.error
    const d = work.divisions.find((x) => x.id === params.id)
    if (!d) return fail('NOT_FOUND', 'Divisi tidak ditemukan.')
    const expected = Number(new URL(request.url).searchParams.get('expected_version'))
    return runWrite<Division>({
      user: g.user,
      operation: 'divisi.deactivate',
      entityType: 'divisi',
      entityId: d.id,
      payload: { expected_version: expected },
      version: { expected, current: d.version },
      refusals: () => {
        const n = work.employees.filter(
          (e) => e.division.id === d.id && e.status === 'aktif',
        ).length
        return n
          ? [
              {
                console: 'hr',
                code: 'DIVISION_NOT_EMPTY',
                message: `Divisi ${d.nama} tidak dapat dinonaktifkan: masih ada ${n} karyawan aktif. Pindahkan atau nonaktifkan mereka dulu.`,
              },
            ]
          : []
      },
      apply: () => {
        d.status = 'nonaktif'
        d.version++
        return structuredClone(d)
      },
      describe: () => ({
        label: `Divisi ${d.kode} dinonaktifkan`,
        changes: { status: { old: 'aktif', new: 'nonaktif' } },
      }),
    })
  }),
]

// ------------------------------------------------------------------ Karyawan

function employeeFields(b: Record<string, unknown>, partial: boolean): Fields {
  const f: Fields = {}
  if ((!partial || 'name' in b) && str(b.name).length < 3)
    f.name = ['Nama wajib diisi, minimal 3 huruf.']
  if (!partial || 'division_id' in b) {
    const div = work.divisions.find((d) => d.id === b.division_id)
    if (!div) f.division_id = ['Pilih divisi.']
    else if (div.status !== 'aktif') f.division_id = [`Divisi ${div.nama} sudah nonaktif.`]
  }
  return f
}

const employeeHandlers = [
  ...readHandlers(
    '/employees',
    'karyawan.view',
    'hr',
    () => work.employees,
    (e) => `${e.nik} ${e.name} ${e.position ?? ''} ${e.division.nama}`,
    'Karyawan tidak ditemukan.',
    'karyawan',
  ),

  http.post(url('/employees'), async ({ request }) => {
    await latency()
    const g = guard(request, 'karyawan.create')
    if (g.error) return g.error
    const b = await body(request)
    const f = employeeFields(b, false)
    if (Object.keys(f).length) return invalid(f)
    const v = scenario422('name')
    if (v) return v
    return runWrite<Employee>({
      user: g.user,
      operation: 'karyawan.create',
      entityType: 'karyawan',
      entityId: null,
      payload: b,
      refusals: () => [],
      apply: () => {
        const div = work.divisions.find((d) => d.id === b.division_id)!
        const n = work.seq.employee++
        const e: Employee = {
          id: `kar-${pad(n)}`,
          nik: `E-${pad(n, 4)}`,
          name: str(b.name),
          division: { id: div.id, nama: div.nama },
          position: str(b.position) || null,
          status: 'aktif',
          version: 1,
          areas: str(b.area) ? [str(b.area)] : [],
          teams: str(b.team) ? [str(b.team)] : [],
        }
        work.employees.push(e)
        return structuredClone(e)
      },
      describe: (e) => ({ label: `Karyawan ${e.nik} dibuat` }),
      status: 201,
    })
  }),

  http.patch(url('/employees/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'karyawan.update')
    if (g.error) return g.error
    const e = work.employees.find((x) => x.id === params.id)
    if (!e) return fail('NOT_FOUND', 'Karyawan tidak ditemukan.')
    const b = await body(request)
    const f = employeeFields(b, true)
    if (Object.keys(f).length) return invalid(f)
    const v = scenario422('name')
    if (v) return v
    const before = structuredClone(e)
    return runWrite<Employee>({
      user: g.user,
      operation: 'karyawan.update',
      entityType: 'karyawan',
      entityId: e.id,
      payload: b,
      version: { expected: num(b.expected_version), current: e.version },
      refusals: () => [],
      apply: () => {
        if ('name' in b) e.name = str(b.name)
        if ('position' in b) e.position = str(b.position) || null
        if ('division_id' in b) {
          const div = work.divisions.find((d) => d.id === b.division_id)!
          e.division = { id: div.id, nama: div.nama }
        }
        if ('area' in b) e.areas = str(b.area) ? [str(b.area)] : []
        if ('team' in b) e.teams = str(b.team) ? [str(b.team)] : []
        e.version++
        return structuredClone(e)
      },
      describe: (after) => ({
        label: `Data karyawan ${after.nik} diperbarui`,
        changes: diff(
          { ...before, division: before.division.nama },
          { ...after, division: after.division.nama },
          ['name', 'position', 'division', 'areas', 'teams'],
        ),
      }),
    })
  }),

  http.delete(url('/employees/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'karyawan.delete')
    if (g.error) return g.error
    const e = work.employees.find((x) => x.id === params.id)
    if (!e) return fail('NOT_FOUND', 'Karyawan tidak ditemukan.')
    const expected = Number(new URL(request.url).searchParams.get('expected_version'))
    return runWrite<Employee>({
      user: g.user,
      operation: 'karyawan.deactivate',
      entityType: 'karyawan',
      entityId: e.id,
      payload: { expected_version: expected },
      version: { expected, current: e.version },
      refusals: () => {
        const n = openOrdersOf(e.id).length
        return n
          ? [
              {
                console: 'hr',
                code: 'EMPLOYEE_HAS_OPEN_ORDERS',
                message: `${e.name} tidak dapat dinonaktifkan: masih memegang ${n} pesanan yang belum selesai.`,
              },
            ]
          : []
      },
      apply: () => {
        e.status = 'nonaktif'
        e.version++
        return structuredClone(e)
      },
      describe: () => ({
        label: `Karyawan ${e.nik} dinonaktifkan`,
        changes: { status: { old: 'aktif', new: 'nonaktif' } },
      }),
    })
  }),
]

// ------------------------------------------------------------------ Barang

function itemFields(b: Record<string, unknown>, partial: boolean, jenis?: Item['jenis']): Fields {
  const f: Fields = {}
  const has = (k: string) => !partial || k in b
  if (has('nama') && str(b.nama).length < 3) f.nama = ['Nama barang wajib diisi, minimal 3 huruf.']
  const kind = (b.jenis as Item['jenis'] | undefined) ?? jenis
  if (has('jenis') && kind !== 'bahan_baku' && kind !== 'barang_jadi')
    f.jenis = ['Pilih jenis barang.']
  if (has('satuan') && !str(b.satuan)) f.satuan = ['Satuan wajib diisi, mis. karung atau pak.']
  if (has('min_stock') && !(num(b.min_stock) >= 0))
    f.min_stock = ['Stok minimum berupa angka 0 atau lebih.']
  if (kind === 'barang_jadi' && has('harga_jual_idr')) {
    const h = num(b.harga_jual_idr)
    if (!(h > 0)) f.harga_jual_idr = ['Harga jual wajib untuk barang jadi.']
    else if (h % 100 !== 0) f.harga_jual_idr = ['Harga jual dibulatkan ke ratusan rupiah.']
  }
  if (
    b.pic_employee_id &&
    !work.employees.some((e) => e.id === b.pic_employee_id && e.status === 'aktif')
  )
    f.pic_employee_id = ['Penanggung jawab harus karyawan aktif.']
  return f
}

const picOf = (id: unknown) => {
  const e = work.employees.find((x) => x.id === id)
  return e ? { id: e.id, name: e.name } : null
}

const itemHandlers = [
  ...readHandlers(
    '/items',
    'barang.view',
    'gudang',
    () => work.items,
    (i) => `${i.sku} ${i.nama}`,
    'Barang tidak ditemukan.',
    'barang',
  ),

  http.post(url('/items'), async ({ request }) => {
    await latency()
    const g = guard(request, 'barang.create')
    if (g.error) return g.error
    const b = await body(request)
    const f = itemFields(b, false)
    if (Object.keys(f).length) return invalid(f)
    const v = scenario422('nama')
    if (v) return v
    return runWrite<Item>({
      user: g.user,
      operation: 'barang.create',
      entityType: 'barang',
      entityId: null,
      payload: b,
      refusals: () => [],
      apply: () => {
        const jenis = b.jenis as Item['jenis']
        const prefix = jenis === 'bahan_baku' ? 'BB' : 'BJ'
        const n = work.seq.item[prefix]++
        const it: Item = {
          id: `brg-${prefix.toLowerCase()}-${pad(n)}`,
          sku: `SKU-${prefix}-${pad(n)}`,
          nama: str(b.nama),
          jenis,
          satuan: str(b.satuan),
          harga_jual_idr: jenis === 'barang_jadi' ? num(b.harga_jual_idr) : null,
          min_stock: num(b.min_stock),
          status: 'aktif',
          version: 1,
          stok_tersedia: 0,
          pic: picOf(b.pic_employee_id),
        }
        work.items.push(it)
        return structuredClone(it)
      },
      describe: (it) => ({ label: `Barang ${it.sku} dibuat` }),
      status: 201,
    })
  }),

  http.patch(url('/items/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'barang.update')
    if (g.error) return g.error
    const it = work.items.find((x) => x.id === params.id)
    if (!it) return fail('NOT_FOUND', 'Barang tidak ditemukan.')
    const b = await body(request)
    const f = itemFields(b, true, it.jenis)
    if (Object.keys(f).length) return invalid(f)
    const v = scenario422('nama')
    if (v) return v
    const before = structuredClone(it)
    return runWrite<Item>({
      user: g.user,
      operation: 'barang.update',
      entityType: 'barang',
      entityId: it.id,
      payload: b,
      version: { expected: num(b.expected_version), current: it.version },
      refusals: () => [],
      apply: () => {
        if ('nama' in b) it.nama = str(b.nama)
        if ('satuan' in b) it.satuan = str(b.satuan)
        if ('min_stock' in b) it.min_stock = num(b.min_stock)
        if ('harga_jual_idr' in b && it.jenis === 'barang_jadi')
          it.harga_jual_idr = num(b.harga_jual_idr)
        if ('pic_employee_id' in b) it.pic = picOf(b.pic_employee_id)
        it.version++
        return structuredClone(it)
      },
      describe: (after) => ({
        label: `Barang ${after.sku} diubah`,
        changes: diff(
          { ...before, pic: before.pic?.name ?? null },
          { ...after, pic: after.pic?.name ?? null },
          ['nama', 'satuan', 'min_stock', 'harga_jual_idr', 'pic'],
        ),
      }),
    })
  }),

  http.delete(url('/items/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'barang.delete')
    if (g.error) return g.error
    const it = work.items.find((x) => x.id === params.id)
    if (!it) return fail('NOT_FOUND', 'Barang tidak ditemukan.')
    const expected = Number(new URL(request.url).searchParams.get('expected_version'))
    return runWrite<Item>({
      user: g.user,
      operation: 'barang.deactivate',
      entityType: 'barang',
      entityId: it.id,
      payload: { expected_version: expected },
      version: { expected, current: it.version },
      refusals: () => {
        const r: ConsoleRefusal[] = []
        if (it.stok_tersedia > 0)
          r.push({
            console: 'gudang',
            code: 'ITEM_HAS_STOCK',
            message: `${it.nama} masih memiliki stok ${it.stok_tersedia} ${it.satuan}. Habiskan atau pindahkan stoknya dulu.`,
          })
        const open = work.orders.filter(
          (o) => o.status === 'ANTRE' && o.lines.some((l) => l.item_id === it.id),
        )
        if (open.length)
          r.push({
            console: 'produksi',
            code: 'ITEM_IN_OPEN_ORDER',
            message: `${it.nama} masih dipakai di ${open.length} pesanan yang belum selesai.`,
          })
        return r
      },
      apply: () => {
        it.status = 'nonaktif'
        it.version++
        return structuredClone(it)
      },
      describe: () => ({
        label: `Barang ${it.sku} dinonaktifkan`,
        changes: { status: { old: 'aktif', new: 'nonaktif' } },
      }),
    })
  }),
]

// ------------------------------------------------------------------ Pesanan

function orderView(o: Order): Order {
  return structuredClone(o)
}

const orderHandlers = [
  ...readHandlers(
    '/orders',
    'pesanan.view',
    'produksi',
    () => work.orders,
    (o) => `${o.order_no} ${o.customer} ${o.pic.name}`,
    'Pesanan tidak ditemukan.',
  ),

  http.post(url('/orders'), async ({ request }) => {
    await latency()
    const g = guard(request, 'pesanan.create')
    if (g.error) return g.error
    const b = await body(request)
    const f: Fields = {}
    if (str(b.customer).length < 3) f.customer = ['Nama pelanggan wajib diisi.']
    const pic = work.employees.find((e) => e.id === b.pic_employee_id)
    if (!pic) f.pic_employee_id = ['Pilih penanggung jawab.']
    const raw = Array.isArray(b.lines) ? (b.lines as { item_id?: unknown; qty?: unknown }[]) : []
    if (!raw.length) f.lines = ['Tambahkan minimal satu barang.']
    raw.forEach((l, i) => {
      const it = work.items.find((x) => x.id === l.item_id)
      if (!it || it.jenis !== 'barang_jadi' || it.status !== 'aktif')
        f[`lines.${i}.item_id`] = ['Pilih barang jadi yang aktif.']
      if (!(Number.isInteger(l.qty) && (l.qty as number) > 0))
        f[`lines.${i}.qty`] = ['Jumlah berupa bilangan bulat lebih dari 0.']
    })
    if (Object.keys(f).length) return invalid(f)
    const v = scenario422('customer')
    if (v) return v
    const lines = raw.map((l) => ({
      item: work.items.find((x) => x.id === l.item_id)!,
      qty: l.qty as number,
    }))
    return runWrite<Order>({
      user: g.user,
      operation: 'pesanan.create',
      entityType: 'pesanan',
      entityId: null,
      payload: b,
      refusals: () => {
        const r: ConsoleRefusal[] = []
        // Merge duplicate lines before checking stock.
        const need = new Map<string, number>()
        for (const l of lines) need.set(l.item.id, (need.get(l.item.id) ?? 0) + l.qty)
        for (const [id, qty] of need) {
          const it = work.items.find((x) => x.id === id)!
          if (qty > it.stok_tersedia)
            r.push({
              console: 'gudang',
              code: 'INSUFFICIENT_STOCK',
              message: `Pesanan tidak dapat dibuat: stok ${it.nama} tidak cukup (tersedia ${it.stok_tersedia}, dibutuhkan ${qty}).`,
            })
        }
        if (pic!.status !== 'aktif')
          r.push({
            console: 'hr',
            code: 'PIC_INACTIVE',
            message: `Pesanan tidak dapat dibuat: ${pic!.name} sudah tidak aktif. Pilih penanggung jawab lain.`,
          })
        else if (openOrdersOf(pic!.id).length >= 5)
          r.push({
            console: 'hr',
            code: 'PIC_OVERLOADED',
            message: `Pesanan tidak dapat dibuat: ${pic!.name} sudah memegang 5 pesanan yang belum selesai. Pilih penanggung jawab lain.`,
          })
        return r
      },
      apply: () => {
        const n = work.seq.order++
        const o: Order = {
          id: `psn-${pad(n)}`,
          order_no: `PO-2026-${pad(n, 4)}`,
          customer: str(b.customer),
          pic: { id: pic!.id, name: pic!.name },
          status: 'ANTRE',
          lines: lines.map(({ item, qty }) => ({
            item_id: item.id,
            sku: item.sku,
            nama: item.nama,
            qty,
            unit_price_idr: item.harga_jual_idr ?? 0,
          })),
          created_at: new Date().toISOString(),
          version: 1,
        }
        // Gudang reserves the stock.
        for (const { item, qty } of lines) {
          item.stok_tersedia -= qty
          item.version++
        }
        work.orders.unshift(o)
        return orderView(o)
      },
      describe: (o) => ({
        label: `Pesanan ${o.order_no} dibuat (${rp(o.lines.reduce((s, l) => s + l.qty * l.unit_price_idr, 0))})`,
      }),
      status: 201,
    })
  }),

  ...(['complete', 'cancel'] as const).map((action) =>
    http.post(url(`/orders/:id/${action}`), async ({ request, params }) => {
      await latency()
      const g = guard(request, action === 'complete' ? 'pesanan.complete' : 'pesanan.cancel')
      if (g.error) return g.error
      const o = work.orders.find((x) => x.id === params.id)
      if (!o) return fail('NOT_FOUND', 'Pesanan tidak ditemukan.')
      const b = await body(request)
      if (o.status !== 'ANTRE')
        return fail(
          'CONFLICT',
          `Pesanan ${o.order_no} sudah ${o.status === 'SELESAI' ? 'selesai' : 'dibatalkan'}. Muat ulang untuk melihat statusnya.`,
        )
      const next = action === 'complete' ? 'SELESAI' : 'DIBATALKAN'
      return runWrite<Order>({
        user: g.user,
        operation: `pesanan.${action}`,
        entityType: 'pesanan',
        entityId: o.id,
        payload: b,
        version: { expected: num(b.expected_version), current: o.version },
        refusals: () => [],
        apply: () => {
          o.status = next
          o.version++
          // Cancelling releases the reserved stock.
          if (action === 'cancel')
            for (const l of o.lines) {
              const it = work.items.find((x) => x.id === l.item_id)
              if (it) {
                it.stok_tersedia += l.qty
                it.version++
              }
            }
          return orderView(o)
        },
        describe: () => ({
          label: `Pesanan ${o.order_no} ${action === 'complete' ? 'diselesaikan' : 'dibatalkan'}`,
          changes: { status: { old: 'ANTRE', new: next } },
        }),
      })
    }),
  ),
]

// ------------------------------------------------------------------ Transaction status (owner)

const txHandlers = [
  http.get(url('/transactions/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const tx = findTx(String(params.id))
    if (!tx || tx.requested_by.id !== g.user.id)
      return fail('NOT_FOUND', 'Status perubahan tidak ditemukan.')
    return ok({ data: txStatusView(tx) })
  }),
]

export const workHandlers = [
  ...divisionHandlers,
  ...employeeHandlers,
  ...itemHandlers,
  ...orderHandlers,
  ...txHandlers,
]
