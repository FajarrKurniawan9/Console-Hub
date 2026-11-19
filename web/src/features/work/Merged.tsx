import type { ReactNode } from 'react'
import { Tooltip } from '../../components/ui/Tooltip'
import { UNAVAILABLE_HINT } from './labels'

/**
 * A column merged from another source. `id` set but `value` null → that source did not answer:
 * grey "Tidak tersedia" with a short tooltip, the row stays intact. No id → "—".
 */
export function Merged({ id, children }: { id: string | null; children: ReactNode | null }) {
  if (children !== null && children !== undefined) return <>{children}</>
  if (!id) return <span className="text-muted">—</span>
  return (
    <Tooltip content={UNAVAILABLE_HINT}>
      <span tabIndex={0} className="text-muted underline decoration-dotted underline-offset-4">
        Tidak tersedia
      </span>
    </Tooltip>
  )
}

/** Label-value list, left aligned (drawers, Lacak Barang). */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-dense">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
