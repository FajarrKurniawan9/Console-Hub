import { PEOPLE } from './people'
import { pad } from './random'

export const DIVISIONS = [
  { id: 1, name: 'Produksi' },
  { id: 2, name: 'Gudang' },
  { id: 3, name: 'HR' },
  { id: 4, name: 'Keuangan' },
  { id: 5, name: 'Logistik' },
]

const ROLES = ['Operator', 'Supervisor', 'Staf', 'Kepala regu', 'Admin']

export const employees = PEOPLE.map((name, i) => {
  const div = DIVISIONS[i % DIVISIONS.length]!
  return {
    id: i + 1,
    nik: `E-${pad(i + 1)}`,
    name,
    division_id: div.id,
    division: div.name,
    role: ROLES[(i * 3) % ROLES.length]!,
    status: i === 7 || i === 10 ? 'nonaktif' : 'aktif',
  }
})

const RAW = [
  ['Tepung terigu', 'kg', 200],
  ['Gula pasir', 'kg', 100],
  ['Minyak sawit', 'liter', 80],
  ['Telur', 'kg', 60],
  ['Mentega', 'kg', 50],
  ['Cokelat bubuk', 'kg', 40],
  ['Kardus kemasan', 'pcs', 500],
  ['Plastik pembungkus', 'roll', 20],
] as const
const FINISHED = [
  'Roti tawar',
  'Biskuit cokelat',
  'Kue bolu pandan',
  'Wafer vanila',
  'Roti manis keju',
  'Kukis mentega',
  'Donat gula',
] as const

export const items = [
  ...RAW.map(([name, unit, min], i) => ({
    id: i + 1,
    sku: `SKU-BB-${pad(i + 1)}`,
    name,
    type: 'bahan baku',
    unit,
    min_stock: min,
  })),
  ...FINISHED.map((name, i) => ({
    id: RAW.length + i + 1,
    sku: `SKU-BJ-${pad(i + 1)}`,
    name,
    type: 'barang jadi',
    unit: 'karton',
    min_stock: 20 + i * 5,
  })),
]

const PRICES = [98_000, 125_000, 142_500, 87_000, 115_000, 156_000]
export const prices = PRICES.map((price, i) => ({
  id: i + 1,
  sku: `SKU-BJ-${pad(i + 1)}`,
  name: FINISHED[i]!,
  price_idr: price,
  updated_at: new Date(Date.now() - (i + 2) * 86_400_000).toISOString(),
}))

export type DataRow = Record<string, unknown> & { id: number }

export const RESOURCES: Record<string, { console: string; rows: DataRow[]; key: string }> = {
  employees: { console: 'hr', rows: employees, key: 'nik' },
  items: { console: 'gudang', rows: items, key: 'sku' },
  prices: { console: 'produksi', rows: prices, key: 'sku' },
}
