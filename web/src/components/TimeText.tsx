import { dateTime, relative, shortTime } from '../lib/format'

/** Absolute or relative time with the full timestamp on hover and for screen readers. */
export function TimeText({
  iso,
  mode = 'full',
}: {
  iso: string
  mode?: 'full' | 'short' | 'relative'
}) {
  const full = dateTime(iso)
  const text = mode === 'full' ? full : mode === 'short' ? shortTime(iso) : relative(iso)
  return (
    <time dateTime={iso} title={full} className="font-mono tabular-nums">
      {text}
    </time>
  )
}
