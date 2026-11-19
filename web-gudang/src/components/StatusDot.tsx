import clsx from 'clsx'

export type Tone = 'ok' | 'warn' | 'error' | 'neutral' | 'accent'

const DOT: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  error: 'bg-error',
  neutral: 'bg-neutral',
  accent: 'bg-accent',
}

/** Colour is never the only signal: a dot always comes with a word. */
export function StatusDot({
  tone,
  label,
  className,
}: {
  tone: Tone
  label: string
  className?: string
}) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span aria-hidden className={clsx('size-2 shrink-0 rounded-full', DOT[tone])} />
      <span>{label}</span>
    </span>
  )
}
