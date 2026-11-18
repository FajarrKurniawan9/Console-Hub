import type { Item, Order } from '../../lib/api/schemas'

export const ACTIVE_FILTER = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'nonaktif', label: 'Nonaktif' },
]

export const JENIS: Record<Item['jenis'], string> = {
  bahan_baku: 'Bahan baku',
  barang_jadi: 'Barang jadi',
}

export const orderTotal = (o: Order) => o.lines.reduce((s, l) => s + l.qty * l.unit_price_idr, 0)
