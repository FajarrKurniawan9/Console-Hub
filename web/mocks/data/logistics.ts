import type { Person, Production, Status } from '../../src/lib/api/schemas'
import { pad } from './random'

// In-memory data of the three source APIs (HR, Produksi, Gudang). The hub engine reads and
// writes these; `resetLogistics()` restores the seed (tests call it between cases).
// Each source only stores reference ids, like the real APIs (kontrak-3-api §1).

/** UUID-shaped, stable ids. Prefix: a1 = HR, b2 = Produksi, c3 = Gudang. */
const uid = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${pad(n, 12)}`
export const personId = (n: number) => uid('a1', n)
export const productionId = (n: number) => uid('b2', n)
export const itemId = (n: number) => uid('c3', n)

export type StoredItem = {
  id: string
  name: string
  kind: string
  production_id: string | null
  responsible_id: string | null
  quantity: number
  unit: string
  status: Status
  version: number
  created_at: string
  updated_at: string
}
export type StoredProduction = Omit<Production, 'courier'>

const DAY = 86_400_000
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()

type PersonSeed = [name: string, role: string, status?: Status]
const PEOPLE: PersonSeed[] = [
  ['Fajar Nugroho', 'Kepala Gudang'],
  ['Joko Susilo', 'Staf Gudang'],
  ['Agus Prasetyo', 'Staf Gudang'],
  ['Ratna Kusuma', 'Operator Produksi'],
  ['Teguh Wibowo', 'Operator Produksi'],
  ['Dedi Kurniawan', 'Kurir'],
  ['Slamet Riyadi', 'Kurir'],
  ['Wahyu Saputra', 'Kurir'],
  ['Dewi Lestari', 'Supervisor Distribusi'],
  ['Yuliana Sari', 'Admin Pencatatan'],
  ['Hendra Gunawan', 'Supervisor Produksi'],
  ['Bambang Setiawan', 'Kurir', 'nonaktif'],
]

type ProductionSeed = [area: string, type: string, courier: number | null, status?: Status]
const PRODUCTIONS: ProductionSeed[] = [
  ['Area Tekstil A', 'Tenun', 6],
  ['Area Logam B', 'Pengecoran', 7],
  ['Area Percetakan', 'Cetak Offset', 8],
  ['Area Pangan', 'Pengalengan', 6],
  ['Area Tekstil A', 'Pewarnaan', null],
  ['Area Logam B', 'Pembubutan', 12, 'nonaktif'],
]

type ItemSeed = [
  name: string,
  kind: string,
  production: number | null,
  responsible: number | null,
  qty: number,
  unit: string,
  status?: Status,
]
const ITEMS: ItemSeed[] = [
  ['Kain katun', 'kain', 1, 2, 340, 'm'],
  ['Kain denim', 'kain', 1, 2, 125, 'm'],
  ['Kain batik cap', 'kain', 5, 3, 60, 'm'],
  ['Benang poliester', 'benang', 1, null, 48, 'gulung'],
  ['Besi beton 10 mm', 'besi', 2, 1, 220, 'batang'],
  ['Plat besi 2 mm', 'besi', 2, 3, 35, 'lembar'],
  ['Pipa besi 1 inci', 'besi', null, 1, 90, 'batang'],
  ['Buku tulis 58 lembar', 'buku', 3, 2, 1200, 'pcs'],
  ['Buku gambar A4', 'buku', 3, null, 450, 'pcs'],
  ['Kalender meja 2027', 'barang cetakan', 3, 10, 300, 'pcs'],
  ['Sarden kaleng 425 g', 'makanan kaleng', 4, 9, 640, 'kaleng'],
  ['Kornet sapi 340 g', 'makanan kaleng', 4, 9, 280, 'kaleng'],
  ['Susu kental manis 370 g', 'makanan kaleng', 4, null, 0, 'kaleng'],
  ['Kardus kemasan besar', 'kemasan', null, null, 1500, 'lembar'],
  ['Mur baut M10', 'besi', 6, 1, 3000, 'pcs', 'nonaktif'],
]

function seed() {
  const people: Person[] = PEOPLE.map(([name, role, status = 'aktif'], i) => ({
    id: personId(i + 1),
    name,
    role,
    status,
    version: 1 + (i % 3),
    created_at: at(90 - i),
    updated_at: at(30 - i),
  }))
  const productions: StoredProduction[] = PRODUCTIONS.map(
    ([area, production_type, courier, status = 'aktif'], i) => ({
      id: productionId(i + 1),
      area,
      production_type,
      courier_id: courier ? personId(courier) : null,
      status,
      version: 1 + (i % 2),
      created_at: at(80 - i),
      updated_at: at(20 - i),
    }),
  )
  const items: StoredItem[] = ITEMS.map(
    ([name, kind, production, responsible, quantity, unit, status = 'aktif'], i) => ({
      id: itemId(i + 1),
      name,
      kind,
      production_id: production ? productionId(production) : null,
      responsible_id: responsible ? personId(responsible) : null,
      quantity,
      unit,
      status,
      version: 1 + (i % 4),
      created_at: at(60 - i * 2),
      updated_at: at(10 - (i % 10)),
    }),
  )
  return { people, productions, items, seq: { person: 13, production: 7, item: 16 } }
}

export const store = seed()

export function resetLogistics() {
  Object.assign(store, seed())
}
