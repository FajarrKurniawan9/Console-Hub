import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardKindItem } from '../../lib/api/schemas'
import { number } from '../../lib/format'

/** Palet warna untuk tiap jenis barang */
const PALETTE = [
  'var(--accent)',
  'var(--ok)',
  'var(--warn)',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#14b8a6',
]

export function KindChart({ items }: { items: DashboardKindItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-dense text-muted">Belum ada data barang.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, items.length * 48)}>
      <BarChart
        layout="vertical"
        data={items}
        margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
        barCategoryGap="25%"
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(v: number) => number(v)}
        />

        <YAxis
          type="category"
          dataKey="kind"
          width={96}
          tick={{ fontSize: 12, fill: 'var(--fg)', fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
        />

        <Tooltip
          cursor={{ fill: 'var(--surface)', opacity: 0.6, radius: 4 }}
          contentStyle={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            padding: '8px 12px',
          }}
          formatter={(value, _name, props) => {
            const v = typeof value === 'number' ? value : Number(value)
            const count = (props.payload as DashboardKindItem | undefined)?.count ?? 0
            return [`${number(v)} unit (${count} barang)`, 'Total kuantitas']
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2 }}
        />

        <Bar dataKey="total_quantity" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {items.map((_, idx) => (
            <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
          ))}
          <LabelList
            dataKey="total_quantity"
            position="right"
            style={{ fontSize: 11, fill: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
            formatter={(v: unknown) => number(typeof v === 'number' ? v : Number(v))}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
