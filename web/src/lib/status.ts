import type { ConsoleStatus, LogLevel, OrderStatus, TxState } from './api/schemas'

export type Tone = 'ok' | 'warn' | 'error' | 'muted' | 'accent'

export const DOT_CLASS: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  error: 'bg-error',
  muted: 'bg-muted',
  accent: 'bg-accent',
}

export const CONSOLE_STATUS: Record<ConsoleStatus, { label: string; tone: Tone }> = {
  ok: { label: 'Normal', tone: 'ok' },
  slow: { label: 'Lambat', tone: 'warn' },
  down: { label: 'Mati', tone: 'error' },
  unknown: { label: 'Belum dicek', tone: 'muted' },
}

export const TX_STATE: Record<TxState, { label: string; tone: Tone }> = {
  preparing: { label: 'Menyiapkan', tone: 'accent' },
  prepared: { label: 'Siap', tone: 'accent' },
  committing: { label: 'Menyelesaikan', tone: 'accent' },
  committed: { label: 'Berhasil', tone: 'ok' },
  aborting: { label: 'Membatalkan', tone: 'warn' },
  aborted: { label: 'Dibatalkan', tone: 'muted' },
  needs_attention: { label: 'Perlu tindakan', tone: 'error' },
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  ANTRE: { label: 'Antre', tone: 'accent' },
  SELESAI: { label: 'Selesai', tone: 'ok' },
  DIBATALKAN: { label: 'Dibatalkan', tone: 'muted' },
}

export const ACTIVE_STATUS: Record<'aktif' | 'nonaktif', { label: string; tone: Tone }> = {
  aktif: { label: 'Aktif', tone: 'ok' },
  nonaktif: { label: 'Nonaktif', tone: 'muted' },
}

export const LOG_LEVEL: Record<LogLevel, { label: string; tone: Tone }> = {
  debug: { label: 'Debug', tone: 'muted' },
  info: { label: 'Info', tone: 'accent' },
  warn: { label: 'Warn', tone: 'warn' },
  error: { label: 'Error', tone: 'error' },
}
