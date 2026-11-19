import type { AreaAccess, Item, LogEntry, Rack } from '../../lib/api/types'
import { uid } from '../random'

export const MOCK_ACCOUNT = { id: 1, name: 'Dewi Lestari', email: 'staf@example.com', password: 'demo12345' }

export const STAFF = ['Dewi Lestari', 'Budi Santoso', 'Agus Prasetyo', 'Rina Wulandari'] as const

type ItemRow = [sku: string, name: string, unit: string, min: number]

const BB: ItemRow[] = [
  ['SKU-BB-001', 'Biji plastik PP', 'kg', 200],
  ['SKU-BB-002', 'Pigmen hitam masterbatch', 'kg', 25],
  ['SKU-BB-003', 'Kardus 60x40x40 cm', 'pcs', 150],
  ['SKU-BB-004', 'Lakban cokelat 48 mm', 'roll', 60],
  ['SKU-BB-005', 'Baut M8 x 30', 'pcs', 500],
  ['SKU-BB-006', 'Kain kanvas 12 oz', 'm', 120],
  ['SKU-BB-007', 'Benang jahit poliester', 'cone', 40],
  ['SKU-BB-008', 'Lem PVAc', 'liter', 30],
]
const BJ: ItemRow[] = [
  ['SKU-BJ-001', 'Kursi plastik lipat', 'pcs', 50],
  ['SKU-BJ-002', 'Ember plastik 20 L', 'pcs', 80],
  ['SKU-BJ-003', 'Kontainer box 50 L', 'pcs', 40],
  ['SKU-BJ-004', 'Tas belanja kanvas', 'pcs', 100],
  ['SKU-BJ-005', 'Rak sepatu susun 4', 'unit', 20],
  ['SKU-BJ-006', 'Hanger plastik isi 12', 'pak', 60],
  ['SKU-BJ-007', 'Tutup ember 20 L', 'pcs', 80],
]

export type ItemRec = Omit<Item, 'stock'>

export const ITEMS: ItemRec[] = [
  ...BB.map(([sku, name, unit, min], i) => ({ id: uid('a1', i + 1), sku, name, kind: 'BB' as const, unit, min_stock: min })),
  ...BJ.map(([sku, name, unit, min], i) => ({ id: uid('a1', i + 9), sku, name, kind: 'BJ' as const, unit, min_stock: min })),
].map((it) => ({ ...it, status: 'aktif' as const, version: 1, locked: it.sku === 'SKU-BJ-003' }))

export type RackRec = Omit<Rack, 'item_count'>

export const RACKS: RackRec[] = (
  [
    ['RAK-A1', 'Rak bahan baku A1', 'Lorong A, sisi kiri', 2400, 'aktif'],
    ['RAK-A2', 'Rak bahan baku A2', 'Lorong A, sisi kanan', 1600, 'aktif'],
    ['RAK-B1', 'Rak barang jadi B1', 'Lorong B, dekat pintu muat', 1200, 'aktif'],
    ['RAK-B2', 'Rak barang jadi B2', 'Lorong B, ujung (sedang diperbaiki)', 1200, 'nonaktif'],
    ['RAK-C1', 'Rak kemasan C1', 'Lorong C', 800, 'aktif'],
    ['RAK-COLD', 'Ruang dingin', 'Sebelah ruang QC, suhu 18–22 °C', null, 'aktif'],
  ] as const
).map(([code, name, location, capacity, status], i) => ({
  id: uid('b2', i + 1),
  code,
  name,
  location,
  capacity,
  status,
  version: 1,
}))

/** Stok awal per [SKU, kode rak, jumlah]. */
export const INITIAL_STOCK: Array<[string, string, number]> = [
  ['SKU-BB-001', 'RAK-A1', 480],
  ['SKU-BB-001', 'RAK-A2', 120],
  ['SKU-BB-002', 'RAK-COLD', 18],
  ['SKU-BB-003', 'RAK-C1', 90],
  ['SKU-BB-003', 'RAK-A2', 30],
  ['SKU-BB-004', 'RAK-C1', 140],
  ['SKU-BB-004', 'RAK-A2', 30],
  ['SKU-BB-005', 'RAK-A1', 1200],
  ['SKU-BB-005', 'RAK-A2', 600],
  ['SKU-BB-005', 'RAK-C1', 300],
  ['SKU-BB-006', 'RAK-A2', 260],
  ['SKU-BB-006', 'RAK-A1', 40],
  ['SKU-BB-007', 'RAK-A1', 22],
  ['SKU-BB-007', 'RAK-C1', 10],
  ['SKU-BB-008', 'RAK-COLD', 45],
  ['SKU-BJ-001', 'RAK-B1', 30],
  ['SKU-BJ-002', 'RAK-B1', 150],
  ['SKU-BJ-002', 'RAK-C1', 60],
  ['SKU-BJ-002', 'RAK-A2', 20],
  ['SKU-BJ-003', 'RAK-B1', 70],
  ['SKU-BJ-004', 'RAK-B1', 210],
  ['SKU-BJ-004', 'RAK-C1', 40],
  ['SKU-BJ-004', 'RAK-A2', 25],
  ['SKU-BJ-005', 'RAK-B1', 24],
  ['SKU-BJ-005', 'RAK-A2', 6],
  ['SKU-BJ-006', 'RAK-C1', 95],
  ['SKU-BJ-006', 'RAK-B1', 40],
  ['SKU-BJ-007', 'RAK-B1', 140],
  ['SKU-BJ-007', 'RAK-C1', 20],
  ['SKU-BJ-007', 'RAK-A2', 15],
]

/** Kejadian setelah stok awal, urut waktu (hari lalu). Dijalankan lewat engine agar konsisten. */
export type ScriptEvent =
  | { at: number; kind: 'add' | 'correct'; sku: string; rack: string; qty: number; reason: string; actor: string }
  | { at: number; kind: 'reserve'; order: string; sku: string; rack: string; qty: number }
  | { at: number; kind: 'release' | 'consume'; order: string }

export const SCRIPT: ScriptEvent[] = [
  { at: 20, kind: 'add', sku: 'SKU-BB-005', rack: 'RAK-A1', qty: 400, reason: 'Penerimaan dari CV Sinar Baja, surat jalan SJ-0412', actor: 'Budi Santoso' },
  { at: 18, kind: 'reserve', order: 'PO-2026-0001', sku: 'SKU-BJ-001', rack: 'RAK-B1', qty: 30 },
  { at: 17, kind: 'reserve', order: 'PO-2026-0002', sku: 'SKU-BJ-002', rack: 'RAK-B1', qty: 40 },
  { at: 16, kind: 'consume', order: 'PO-2026-0001' },
  { at: 15, kind: 'reserve', order: 'PO-2026-0003', sku: 'SKU-BJ-004', rack: 'RAK-B1', qty: 60 },
  { at: 14, kind: 'release', order: 'PO-2026-0002' },
  { at: 12, kind: 'correct', sku: 'SKU-BB-003', rack: 'RAK-C1', qty: 84, reason: 'Stok opname: 6 kardus basah terkena bocor atap', actor: 'Agus Prasetyo' },
  { at: 11, kind: 'consume', order: 'PO-2026-0003' },
  { at: 9, kind: 'reserve', order: 'PO-2026-0004', sku: 'SKU-BJ-007', rack: 'RAK-B1', qty: 50 },
  { at: 7, kind: 'reserve', order: 'PO-2026-0005', sku: 'SKU-BJ-002', rack: 'RAK-B1', qty: 25 },
  { at: 6, kind: 'reserve', order: 'PO-2026-0006', sku: 'SKU-BJ-005', rack: 'RAK-B1', qty: 18 },
  { at: 5, kind: 'add', sku: 'SKU-BJ-006', rack: 'RAK-C1', qty: 35, reason: 'Retur dari toko cabang Bekasi, kondisi baik', actor: 'Rina Wulandari' },
  { at: 4, kind: 'release', order: 'PO-2026-0006' },
  { at: 3, kind: 'reserve', order: 'PO-2026-0007', sku: 'SKU-BJ-003', rack: 'RAK-B1', qty: 20 },
  { at: 2, kind: 'reserve', order: 'PO-2026-0008', sku: 'SKU-BJ-004', rack: 'RAK-B1', qty: 45 },
  { at: 1, kind: 'correct', sku: 'SKU-BB-007', rack: 'RAK-A1', qty: 20, reason: 'Hitung ulang: 2 cone kusut tidak layak pakai', actor: 'Dewi Lestari' },
]

const AREAS = ['Gudang bahan baku', 'Gudang barang jadi', 'Ruang dingin', 'Area bongkar muat'] as const

export function areaAccess(now: number): AreaAccess[] {
  const day = 86_400_000
  const rows: Array<[string, string, number, number, number | null]> = [
    ['E-0003', 'Siti Rahmawati', 0, 120, null],
    ['E-0003', 'Siti Rahmawati', 3, 120, null],
    ['E-0005', 'Hendra Gunawan', 1, 90, null],
    ['E-0005', 'Hendra Gunawan', 2, 90, 30],
    ['E-0007', 'Fajar Nugroho', 3, 75, null],
    ['E-0008', 'Ratna Kusuma', 0, 60, 12],
    ['E-0009', 'Joko Susilo', 1, 45, null],
    ['E-0009', 'Joko Susilo', 3, 45, null],
    ['E-0011', 'Maya Anggraini', 2, 20, null],
    ['E-0012', 'Teguh Wibowo', 0, 14, 2],
  ]
  return rows.map(([nik, name, area, granted, revoked]) => ({
    employee_nik: nik,
    employee_name: name,
    area: AREAS[area]!,
    granted_at: new Date(now - granted * day).toISOString(),
    revoked_at: revoked === null ? null : new Date(now - revoked * day).toISOString(),
  }))
}

/** Templat log harian console gudang. */
export const LOG_TEMPLATES: Array<[LogEntry['level'], string, string | null]> = [
  ['info', 'Sinkronisasi data barang dari Console Hub selesai: 15 barang, 0 perubahan.', 'Sistem'],
  ['info', 'Staf masuk ke console gudang.', 'Budi Santoso'],
  ['info', 'Staf masuk ke console gudang.', 'Agus Prasetyo'],
  ['debug', 'Console Hub memeriksa kesehatan console (GET /internal/v1/health, 84 ms).', 'Sistem'],
  ['debug', 'Console Hub membaca stok barang (GET /internal/v1/items, 132 ms).', 'Sistem'],
  ['warn', 'Stok menipis: SKU-BB-002 Pigmen hitam masterbatch tersedia 18 kg, minimum 25 kg.', 'Sistem'],
  ['warn', 'Stok menipis: SKU-BB-007 Benang jahit poliester di bawah batas minimum.', 'Sistem'],
  ['info', 'Reservasi dibuat untuk pesanan dari Console Hub.', 'Sistem'],
  ['warn', 'Permintaan reservasi ditahan karena barang sedang diproses: SKU-BJ-003 Kontainer box 50 L.', 'Sistem'],
  [
    'error',
    'Gagal menyiapkan reservasi pesanan PO-2026-0009: stok SKU-BJ-001 Kursi plastik lipat tidak mencukupi (diminta 12 pcs, tersedia 0 pcs). Console Hub menerima penolakan dan pesanan tidak dilanjutkan; tidak ada stok yang berubah di gudang.',
    'Sistem',
  ],
  ['error', 'Koneksi ke Console Hub terputus saat mengirim konfirmasi. Dicoba ulang otomatis dalam 30 detik.', 'Sistem'],
  ['info', 'Pencadangan harian data gudang selesai.', 'Sistem'],
]
