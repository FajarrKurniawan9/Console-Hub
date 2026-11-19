export type StockLevel = 'ok' | 'low' | 'out'

/** Habis bila tidak ada yang tersedia, menipis bila di bawah stok minimum. */
export function stockLevel(available: number, minStock: number): StockLevel {
  if (available <= 0) return 'out'
  if (available < minStock) return 'low'
  return 'ok'
}
