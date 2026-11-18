import { format, formatDistanceToNowStrict } from 'date-fns'
import { id } from 'date-fns/locale'

const LOCALE = 'id-ID'

/** "17 Nov 2026, 14:30:12" in the browser's time zone. */
export function dateTime(iso: string) {
  return format(new Date(iso), 'd MMM yyyy, HH:mm:ss', { locale: id })
}

/** "14:30" today, otherwise "17 Nov, 14:30". */
export function shortTime(iso: string, now = new Date()) {
  const d = new Date(iso)
  const sameDay = d.toDateString() === now.toDateString()
  return format(d, sameDay ? 'HH:mm' : 'd MMM, HH:mm', { locale: id })
}

/** "20 detik lalu". */
export function relative(iso: string) {
  return `${formatDistanceToNowStrict(new Date(iso), { locale: id })} lalu`
}

/** 840 → "840 ms", 2430 → "2,4 dtk", 75000 → "1 mnt 15 dtk". */
export function duration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${number(ms / 1000, 1)} dtk`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return s ? `${m} mnt ${s} dtk` : `${m} mnt`
}

export function runDuration(started: string | null, finished: string | null, now = Date.now()) {
  if (!started) return null
  return duration((finished ? new Date(finished).getTime() : now) - new Date(started).getTime())
}

export function number(n: number, maxFraction = 0) {
  return n.toLocaleString(LOCALE, { maximumFractionDigits: maxFraction })
}

/** Display any record cell value as plain text. */
export function cell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return number(value, 2)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** 18500 → "Rp18.500". */
export function rupiah(n: number) {
  return `Rp${number(n)}`
}
