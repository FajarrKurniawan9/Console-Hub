import clsx from 'clsx'
import { Link } from 'react-router'
import { ConsoleStatusDot } from '../../../components/StatusDot'
import { duration, relative, shortTime } from '../../../lib/format'
import type { ConsoleInfo } from '../../../lib/api/schemas'
import { downSince } from './queries'

export function ConsoleCard({ console: c }: { console: ConsoleInfo }) {
  const down = c.status === 'down'
  const since = downSince(c)
  return (
    <Link
      to={`/console/${c.id}`}
      className={clsx(
        'flex flex-col gap-1.5 rounded-md border bg-bg p-3 transition-colors duration-150 hover:bg-surface',
        down && 'border-error',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{c.name}</span>
        <span className="font-mono text-xs text-muted tabular-nums">
          {c.last_latency_ms !== null ? duration(c.last_latency_ms) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-dense">
        <ConsoleStatusDot status={c.status} />
        <span className="text-xs text-muted">
          {c.last_checked_at ? `dicek ${relative(c.last_checked_at)}` : 'belum pernah dicek'}
        </span>
      </div>
      {down ? (
        <p className="text-xs text-muted">
          {since ? `Mati sejak ${shortTime(since)}. ` : ''}
          <span className="font-mono">{c.last_error}</span>
        </p>
      ) : null}
    </Link>
  )
}
