import { useState } from 'react'
import type { DashboardTrendPoint } from '../../lib/api/schemas'

export function TrendChart({ points }: { points: DashboardTrendPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="py-8 text-center text-dense text-muted">Belum ada riwayat aktivitas.</p>
  }

  // Find max value across all points
  const maxVal = Math.max(
    ...points.map((p) => Math.max(p.created, p.updated, p.deactivated)),
    5, // minimum ceiling so grid is clean
  )

  const chartHeight = 160
  const chartWidth = 600
  const padLeft = 32
  const padBottom = 28
  const padTop = 16
  const padRight = 16

  const usableWidth = chartWidth - padLeft - padRight
  const usableHeight = chartHeight - padTop - padBottom
  const barGroupWidth = usableWidth / points.length
  const barWidth = Math.max(2, Math.min(10, (barGroupWidth - 6) / 3))

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null

  return (
    <div className="flex flex-col gap-3">
      {/* Legend & Hover Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[var(--ok)]" aria-hidden />
            <span className="text-muted">Dibuat</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[var(--warn)]" aria-hidden />
            <span className="text-muted">Diubah</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs bg-[var(--error)]" aria-hidden />
            <span className="text-muted">Dinonaktifkan</span>
          </span>
        </div>

        {activePoint ? (
          <div className="font-semibold text-fg">
            <span className="text-muted">{formatDate(activePoint.date)}:</span>{' '}
            <span className="text-[var(--ok)]">+{activePoint.created}</span> ·{' '}
            <span className="text-[var(--warn)]">~{activePoint.updated}</span> ·{' '}
            <span className="text-[var(--error)]">-{activePoint.deactivated}</span>
          </div>
        ) : (
          <span className="text-muted">Arahkan kursor ke grafik untuk melihat detail</span>
        )}
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[500px] select-none text-xs"
          role="img"
          aria-label="Grafik tren transaksi barang harian"
        >
          {/* Horizontal Grid lines */}
          {[0, 0.5, 1].map((pct) => {
            const y = padTop + usableHeight * (1 - pct)
            const val = Math.round(maxVal * pct)
            return (
              <g key={pct}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={chartWidth - padRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="2 3"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[var(--text-muted)] text-[10px]"
                >
                  {val}
                </text>
              </g>
            )
          })}

          {/* Bars per Date */}
          {points.map((p, i) => {
            const groupX = padLeft + i * barGroupWidth
            const centerX = groupX + barGroupWidth / 2

            const hCreated = (p.created / maxVal) * usableHeight
            const hUpdated = (p.updated / maxVal) * usableHeight
            const hDeactivated = (p.deactivated / maxVal) * usableHeight

            const yBaseline = padTop + usableHeight

            const isHovered = hoveredIndex === i

            return (
              <g
                key={p.date}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Background hover highlight */}
                {isHovered ? (
                  <rect
                    x={groupX}
                    y={padTop}
                    width={barGroupWidth}
                    height={usableHeight}
                    fill="var(--surface)"
                    opacity={0.7}
                    rx={2}
                  />
                ) : null}

                {/* Created Bar */}
                <rect
                  x={centerX - barWidth * 1.5 - 1}
                  y={yBaseline - hCreated}
                  width={barWidth}
                  height={Math.max(1, hCreated)}
                  fill="var(--ok)"
                  rx={1}
                />

                {/* Updated Bar */}
                <rect
                  x={centerX - barWidth * 0.5}
                  y={yBaseline - hUpdated}
                  width={barWidth}
                  height={Math.max(1, hUpdated)}
                  fill="var(--warn)"
                  rx={1}
                />

                {/* Deactivated Bar */}
                <rect
                  x={centerX + barWidth * 0.5 + 1}
                  y={yBaseline - hDeactivated}
                  width={barWidth}
                  height={Math.max(1, hDeactivated)}
                  fill="var(--error)"
                  rx={1}
                />

                {/* X-axis date label (show every 2-3 dates if many points) */}
                {(points.length <= 10 || i % Math.ceil(points.length / 7) === 0 || i === points.length - 1) ? (
                  <text
                    x={centerX}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    className="fill-[var(--text-muted)] text-[10px]"
                  >
                    {formatDateShort(p.date)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function formatDate(isoDate: string): string {
  try {
    const parts = isoDate.split('-')
    if (parts.length < 3) return isoDate
    const [y, m, d] = parts as [string, string, string]
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const monthIdx = parseInt(m, 10) - 1
    return `${parseInt(d, 10)} ${months[monthIdx] ?? m} ${y}`
  } catch {
    return isoDate
  }
}

function formatDateShort(isoDate: string): string {
  try {
    const parts = isoDate.split('-')
    if (parts.length < 3) return isoDate
    const [, m, d] = parts as [string, string, string]
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const monthIdx = parseInt(m, 10) - 1
    return `${parseInt(d, 10)} ${months[monthIdx] ?? m}`
  } catch {
    return isoDate
  }
}
