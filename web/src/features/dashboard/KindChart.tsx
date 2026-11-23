import type { DashboardKindItem } from '../../lib/api/schemas'
import { number } from '../../lib/format'

export function KindChart({ items }: { items: DashboardKindItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-dense text-muted">Belum ada data barang.</p>
  }

  const maxQty = Math.max(...items.map((i) => i.total_quantity), 1)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Jenis barang</span>
        <span>Total kuantitas & jumlah barang</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const pct = Math.max(4, Math.round((item.total_quantity / maxQty) * 100))

          return (
            <div key={item.kind} className="flex flex-col gap-1 text-dense">
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize">{item.kind}</span>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="font-semibold">{number(item.total_quantity)}</span>
                  <span className="text-xs text-muted">({item.count} barang)</span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface border border-border">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
