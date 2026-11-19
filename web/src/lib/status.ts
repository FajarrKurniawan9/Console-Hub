import type { ConsoleStatus, LogLevel, SourceStatus } from './api/schemas'

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

/** Per-source result of one merged read (Lacak Barang, Admin IT). */
export const SOURCE_RESULT: Record<SourceStatus['status'], { label: string; tone: Tone }> = {
  ok: { label: 'Berhasil', tone: 'ok' },
  unavailable: { label: 'Tidak tersedia', tone: 'error' },
  not_found: { label: 'Tidak ditemukan', tone: 'warn' },
}
