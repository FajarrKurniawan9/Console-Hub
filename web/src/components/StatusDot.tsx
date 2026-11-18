import clsx from 'clsx'
import type { ConsoleStatus, LogLevel, RunStatus, StepStatus } from '../lib/schemas'
import {
  CONSOLE_STATUS,
  LOG_LEVEL,
  RUN_STATUS,
  STEP_STATUS,
  DOT_CLASS,
  type Tone,
} from '../lib/status'

/** Colour is never the only signal: a dot always comes with a word. */
export function Dot({
  tone,
  label,
  pulse,
  className,
}: {
  tone: Tone
  label: string
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span
        aria-hidden
        className={clsx(
          'size-2 shrink-0 rounded-full',
          DOT_CLASS[tone],
          pulse && 'animate-pulse-dot',
        )}
      />
      <span>{label}</span>
    </span>
  )
}

export function ConsoleStatusDot({ status }: { status: ConsoleStatus }) {
  return <Dot {...CONSOLE_STATUS[status]} />
}

export function RunStatusDot({ status }: { status: RunStatus }) {
  return <Dot {...RUN_STATUS[status]} pulse={status === 'running'} />
}

export function StepStatusDot({ status }: { status: StepStatus }) {
  return <Dot {...STEP_STATUS[status]} pulse={status === 'running'} />
}

export function LevelBadge({ level }: { level: LogLevel }) {
  return <Dot {...LOG_LEVEL[level]} className={clsx(level === 'error' && 'font-semibold')} />
}
