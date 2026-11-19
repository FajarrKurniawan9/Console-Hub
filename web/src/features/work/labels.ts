import type { Source } from '../../lib/api/schemas'

export const ACTIVE_FILTER = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'nonaktif', label: 'Nonaktif' },
  { value: 'all', label: 'Semua' },
]

/** Admin IT copy: which source API holds the data. */
export const SOURCE_LABEL: Record<Source, string> = {
  gudang: 'Gudang',
  produksi: 'Produksi',
  hr: 'HR',
}

/** `used_by[].type` from the hub. */
export const TYPE_LABEL: Record<string, string> = {
  item: 'Barang',
  production: 'Produksi',
  person: 'Personel',
}

/** "Tidak tersedia" tooltip for a merged column whose source did not answer. */
export const UNAVAILABLE_HINT = 'Data ini sedang tidak dapat diambil. Coba muat ulang nanti.'
