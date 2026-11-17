import clsx from 'clsx'
import type { RunStep } from '../../lib/schemas'
import { STEP_STATUS } from '../../lib/status'

const BOX: Record<string, string> = {
  ok: 'border-ok bg-ok/10',
  warn: 'border-warn bg-warn/10',
  error: 'border-error bg-error/10',
  accent: 'border-accent bg-accent/10',
  muted: 'border-border bg-surface',
}

/** One box per step with number, colour and word; click to jump to the step. */
export function StepStrip({
  steps,
  selected,
  onSelect,
}: {
  steps: RunStep[]
  selected: number | null
  onSelect: (pos: number) => void
}) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Ringkasan status langkah">
      {steps.map((s) => {
        const meta = STEP_STATUS[s.status]
        return (
          <li key={s.position}>
            <button
              type="button"
              onClick={() => onSelect(s.position)}
              aria-pressed={selected === s.position}
              aria-label={`Langkah ${s.position}, ${s.name}: ${meta.label}`}
              className={clsx(
                'flex h-12 w-36 flex-col justify-center rounded-md border px-2.5 text-left transition-colors duration-150',
                BOX[meta.tone],
                selected === s.position && 'ring-2 ring-accent',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs">
                <span className="font-mono text-muted">{s.position}</span>
                <span
                  className={clsx(
                    'truncate font-semibold',
                    s.status === 'running' && 'animate-pulse-dot',
                  )}
                >
                  {meta.label}
                </span>
              </span>
              <span className="truncate text-xs text-muted">{s.name}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
