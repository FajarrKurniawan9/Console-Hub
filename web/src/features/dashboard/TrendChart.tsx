import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardTrendPoint } from '../../lib/api/schemas'

/** Format "2026-11-23" → "23 Nov" untuk label sumbu X */
function formatDateShort(isoDate: string): string {
  try {
    const parts = isoDate.split('-')
    if (parts.length < 3) return isoDate
    const [, m, d] = parts as [string, string, string]
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1] ?? m}`
  } catch {
    return isoDate
  }
}

/** Format "2026-11-23" → "23 Nov 2026" untuk tooltip */
function formatDateFull(isoDate: string): string {
  try {
    const parts = isoDate.split('-')
    if (parts.length < 3) return isoDate
    const [y, m, d] = parts as [string, string, string]
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1] ?? m} ${y}`
  } catch {
    return isoDate
  }
}

export function TrendChart({ points }: { points: DashboardTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="py-8 text-center text-dense text-muted">Belum ada riwayat aktivitas.</p>
  }

  // Tambah label pendek untuk sumbu X
  const data = points.map((p) => ({ ...p, label: formatDateShort(p.date) }))

  // Hanya tampilkan sebagian label X jika terlalu banyak titik
  const tickInterval = points.length > 14 ? Math.ceil(points.length / 7) - 1 : 0

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        barCategoryGap="30%"
        barGap={2}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          interval={tickInterval}
        />

        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickLine={false}
          axisLine={false}
          width={28}
        />

        <Tooltip
          cursor={{ fill: 'var(--surface)', opacity: 0.7, radius: 4 }}
          contentStyle={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            padding: '8px 12px',
          }}
          labelFormatter={(_, payload) => {
            const raw = (payload?.[0]?.payload as DashboardTrendPoint | undefined)?.date
            return raw ? formatDateFull(raw) : ''
          }}
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              created: 'Dibuat',
              updated: 'Diubah',
              deactivated: 'Dinonaktifkan',
            }
            const key = typeof name === 'string' ? name : String(name)
            return [value, labels[key] ?? key]
          }}
        />

        <Legend
          iconType="square"
          iconSize={10}
          formatter={(value) => {
            const labels: Record<string, string> = {
              created: 'Dibuat',
              updated: 'Diubah',
              deactivated: 'Dinonaktifkan',
            }
            return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{labels[value] ?? value}</span>
          }}
        />

        <Bar dataKey="created" fill="var(--ok)" radius={[3, 3, 0, 0]} maxBarSize={18} />
        <Bar dataKey="updated" fill="var(--warn)" radius={[3, 3, 0, 0]} maxBarSize={18} />
        <Bar dataKey="deactivated" fill="var(--error)" radius={[3, 3, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}
