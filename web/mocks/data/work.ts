import type { Division, Employee, Item, Order } from '../../src/lib/api/schemas'

// In-memory work data. Writes go through the transaction engine, which mutates these arrays.
// `resetWork()` restores the seed (tests call it between cases).

function seedDivisions(): Division[] {
  return [
    { id: 'div-hrd', kode: 'HRD', nama: 'HRD', status: 'aktif', version: 3 },
    { id: 'div-gdg', kode: 'GDG', nama: 'Gudang', status: 'aktif', version: 2 },
    { id: 'div-prd', kode: 'PRD', nama: 'Produksi', status: 'aktif', version: 4 },
    { id: 'div-keu', kode: 'KEU', nama: 'Keuangan', status: 'aktif', version: 1 },
  ]
}

type EmpSeed = [name: string, div: string, position: string, areas: string[], teams: string[]]
const EMPLOYEES: EmpSeed[] = [
  ['Rina Wulandari', 'div-hrd', 'Kepala HRD', [], []],
  ['Budi Santoso', 'div-prd', 'Staf administrasi produksi', [], ['Shift Pagi']],
  ['Siti Rahmawati', 'div-hrd', 'Staf rekrutmen', [], []],
  ['Agus Prasetyo', 'div-gdg', 'Operator forklift', ['Gudang A'], []],
  ['Dewi Lestari', 'div-prd', 'Supervisor produksi', [], ['Shift Pagi']],
  ['Hendra Gunawan', 'div-prd', 'Koordinator pesanan', [], ['Shift Siang']],
  ['Yuliana Sari', 'div-keu', 'Staf akuntansi', [], []],
  ['Fajar Nugroho', 'div-gdg', 'Kepala gudang', ['Gudang A', 'Gudang B'], []],
  ['Ratna Kusuma', 'div-prd', 'Operator mesin', [], ['Shift Malam']],
  ['Joko Susilo', 'div-gdg', 'Staf penerimaan barang', ['Gudang B'], []],
  ['Maya Anggraini', 'div-keu', 'Kepala keuangan', [], []],
  ['Teguh Wibowo', 'div-prd', 'Operator pengemasan', [], ['Shift Siang']],
]

const pad = (n: number, w = 3) => String(n).padStart(w, '0')
const divName = (id: string) => seedDivisions().find((d) => d.id === id)!.nama

function seedEmployees(): Employee[] {
  return EMPLOYEES.map(([name, div, position, areas, teams], i) => ({
    id: `kar-${pad(i + 1)}`,
    nik: `E-${pad(i + 1, 4)}`,
    name,
    division: { id: div, nama: divName(div) },
    position,
    status: 'aktif',
    version: 1 + (i % 3),
    areas,
    teams,
  }))
}

type ItemSeed = [
  nama: string,
  satuan: string,
  harga: number | null,
  min: number,
  stok: number,
  pic: number | null,
]
const RAW: ItemSeed[] = [
  ['Tepung terigu 25 kg', 'karung', null, 40, 186, 8],
  ['Gula pasir 50 kg', 'karung', null, 30, 22, 8],
  ['Minyak goreng 18 L', 'jeriken', null, 20, 64, 10],
  ['Mentega industri 15 kg', 'dus', null, 15, 31, 10],
  ['Telur ayam 15 kg', 'peti', null, 25, 48, 4],
  ['Kemasan kardus A', 'lembar', null, 500, 2_400, 10],
  ['Plastik kemasan 1 kg', 'rol', null, 40, 0, 4],
  ['Label stiker produk', 'rol', null, 30, 75, 10],
]
const FINISHED: ItemSeed[] = [
  ['Roti tawar kupas 400 g', 'pak', 18_500, 50, 120, 6],
  ['Roti manis cokelat isi 10', 'pak', 27_000, 40, 260, 6],
  ['Kue kering nastar 500 g', 'toples', 85_000, 20, 96, 5],
  ['Bolu pandan loyang 22 cm', 'loyang', 62_500, 15, 40, 5],
  ['Donat gula isi 12', 'dus', 45_000, 30, 0, null],
  ['Pia kacang hijau isi 20', 'dus', 54_000, 20, 150, 6],
  ['Roti gandum utuh 500 g', 'pak', 32_500, 25, 70, 5],
]

function seedItems(employees: Employee[]): Item[] {
  const make = (rows: ItemSeed[], prefix: 'BB' | 'BJ', jenis: Item['jenis']) =>
    rows.map(([nama, satuan, harga, min, stok, pic], i): Item => {
      const p = pic ? employees[pic - 1]! : null
      return {
        id: `brg-${prefix.toLowerCase()}-${pad(i + 1)}`,
        sku: `SKU-${prefix}-${pad(i + 1)}`,
        nama,
        jenis,
        satuan,
        harga_jual_idr: harga,
        min_stock: min,
        // The last raw material is retired, to show the dimmed row.
        status: prefix === 'BB' && i === 6 ? 'nonaktif' : 'aktif',
        version: 1 + (i % 4),
        stok_tersedia: stok,
        pic: p ? { id: p.id, name: p.name } : null,
      }
    })
  return [...make(RAW, 'BB', 'bahan_baku'), ...make(FINISHED, 'BJ', 'barang_jadi')]
}

type OrderSeed = [
  customer: string,
  pic: number,
  status: Order['status'],
  daysAgo: number,
  lines: [number, number][],
]
// Hendra (6) already holds 5 open orders, so a sixth is refused with PIC_OVERLOADED.
const ORDERS: OrderSeed[] = [
  [
    'CV Sumber Rezeki',
    6,
    'ANTRE',
    0.2,
    [
      [1, 40],
      [2, 20],
    ],
  ],
  ['PT Maju Bersama', 6, 'ANTRE', 0.6, [[3, 12]]],
  [
    'UD Sinar Jaya',
    6,
    'ANTRE',
    1.1,
    [
      [6, 30],
      [7, 10],
    ],
  ],
  ['Toko Roti Melati', 6, 'ANTRE', 1.8, [[1, 25]]],
  ['Kafe Kopi Senja', 6, 'ANTRE', 2.4, [[4, 6]]],
  ['Koperasi Karyawan Sejahtera', 5, 'ANTRE', 3.1, [[2, 50]]],
  [
    'PT Pangan Nusantara',
    5,
    'SELESAI',
    4.5,
    [
      [1, 60],
      [6, 40],
    ],
  ],
  ['Hotel Griya Asri', 2, 'DIBATALKAN', 6.0, [[3, 8]]],
]

function seedOrders(employees: Employee[], items: Item[]): Order[] {
  const finished = items.filter((i) => i.jenis === 'barang_jadi')
  return ORDERS.map(([customer, pic, status, daysAgo, lines], i) => {
    const p = employees[pic - 1]!
    return {
      id: `psn-${pad(i + 1)}`,
      order_no: `PO-2026-${pad(i + 1, 4)}`,
      customer,
      pic: { id: p.id, name: p.name },
      status,
      lines: lines.map(([n, qty]) => {
        const it = finished[n - 1]!
        return {
          item_id: it.id,
          sku: it.sku,
          nama: it.nama,
          qty,
          unit_price_idr: it.harga_jual_idr!,
        }
      }),
      created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      version: status === 'ANTRE' ? 1 : 2,
    }
  })
}

function seed() {
  const employees = seedEmployees()
  const items = seedItems(employees)
  return {
    divisions: seedDivisions(),
    employees,
    items,
    orders: seedOrders(employees, items),
    seq: { employee: 13, item: { BB: 9, BJ: 8 }, order: 9, division: 5 },
  }
}

export const work = seed()

export function resetWork() {
  Object.assign(work, seed())
}

export const openOrdersOf = (employeeId: string) =>
  work.orders.filter((o) => o.status === 'ANTRE' && o.pic.id === employeeId)

export { pad }
