import type { ConsoleStatus, LogLevel, RunStatus, StepStatus } from './schemas'

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

export const RUN_STATUS: Record<RunStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Antre', tone: 'muted' },
  running: { label: 'Berjalan', tone: 'accent' },
  succeeded: { label: 'Berhasil', tone: 'ok' },
  failed: { label: 'Gagal', tone: 'error' },
  canceled: { label: 'Dibatalkan', tone: 'muted' },
}

export const STEP_STATUS: Record<StepStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Menunggu', tone: 'muted' },
  running: { label: 'Berjalan', tone: 'accent' },
  succeeded: { label: 'Berhasil', tone: 'ok' },
  failed: { label: 'Gagal', tone: 'error' },
  skipped: { label: 'Dilewati', tone: 'muted' },
  compensated: { label: 'Dikompensasi', tone: 'warn' },
  compensation_failed: { label: 'Kompensasi gagal', tone: 'error' },
}

export const LOG_LEVEL: Record<LogLevel, { label: string; tone: Tone }> = {
  debug: { label: 'Debug', tone: 'muted' },
  info: { label: 'Info', tone: 'accent' },
  warn: { label: 'Warn', tone: 'warn' },
  error: { label: 'Error', tone: 'error' },
}
