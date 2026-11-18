import clsx from 'clsx'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Tone } from '../../lib/status'

const BORDER: Record<Tone, string> = {
  ok: 'border-ok',
  warn: 'border-warn',
  error: 'border-error',
  accent: 'border-accent',
  muted: '',
}

/** Shared shell: titled region, polite live updates, manual close only. */
export function TrailFrame({
  title,
  tone,
  onClose,
  children,
}: {
  title: string
  tone: Tone
  onClose?: () => void
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      aria-live="polite"
      className={clsx('flex flex-col gap-2 rounded-md border bg-bg px-3 py-2.5', BORDER[tone])}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-dense font-semibold">{title}</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Tutup ${title.toLowerCase()}`}
            className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface hover:text-fg"
          >
            <X size={16} strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  )
}
