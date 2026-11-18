import clsx from 'clsx'
import type { ConsoleStatus, LogLevel, OrderStatus, TxState } from '../lib/api/schemas'
import {
  ACTIVE_STATUS,
  CONSOLE_STATUS,
  DOT_CLASS,
  LOG_LEVEL,
  ORDER_STATUS,
  TX_STATE,
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

export function TxStateBadge({ state }: { state: TxState }) {
  const busy = state === 'preparing' || state === 'committing' || state === 'aborting'
  return (
    <Dot
      {...TX_STATE[state]}
      pulse={busy}
      className={clsx(state === 'needs_attention' && 'font-semibold')}
    />
  )
}

export function OrderStatusDot({ status }: { status: OrderStatus }) {
  return <Dot {...ORDER_STATUS[status]} />
}

export function ActiveStatusDot({ status }: { status: 'aktif' | 'nonaktif' }) {
  return <Dot {...ACTIVE_STATUS[status]} />
}

export function LevelBadge({ level }: { level: LogLevel }) {
  return <Dot {...LOG_LEVEL[level]} className={clsx(level === 'error' && 'font-semibold')} />
}
