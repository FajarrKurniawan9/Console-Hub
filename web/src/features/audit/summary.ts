import type { AuditEvent } from '../../lib/schemas'
import { display, specFor } from '../resources/fields'

export const ACTIONS: Record<string, string> = {
  'resource.updated': 'Data diubah',
  'run.started': 'Proses dijalankan',
  'run.retried': 'Eksekusi diulang',
  'run.canceled': 'Eksekusi dibatalkan',
  'console.tested': 'Koneksi diuji',
  'logs.synced': 'Log ditarik',
  'auth.login': 'Masuk',
}

type Change = { old: unknown; new: unknown }
const isChange = (v: unknown): v is Change =>
  !!v && typeof v === 'object' && 'old' in v && 'new' in v

/** Old → new pairs from `details.changes`, if the event has them. */
export function changesOf(
  e: AuditEvent,
): { field: string; label: string; old: string; new: string }[] {
  const changes = e.details?.changes
  if (!changes || typeof changes !== 'object') return []
  return Object.entries(changes as Record<string, unknown>)
    .filter(([, v]) => isChange(v))
    .map(([field, v]) => {
      const c = v as Change
      return {
        field,
        label: specFor(field).label,
        old: display(field, c.old),
        new: display(field, c.new),
      }
    })
}

/** One plain line for events without field changes. */
export function summaryOf(e: AuditEvent): string {
  const d = e.details ?? {}
  switch (e.action) {
    case 'run.started':
    case 'run.canceled':
      return typeof d.process === 'string' ? d.process : ''
    case 'run.retried':
      return `${String(d.process ?? '')} · ulangan dari ${String(d.retry_of ?? '?')}${d.mode === 'from_start' ? ' (dari awal)' : d.mode === 'from_failed' ? ' (dari langkah gagal)' : ''}`
    case 'console.tested':
      return `hasil ${String(d.status ?? '?')}${typeof d.latency_ms === 'number' ? `, ${d.latency_ms} ms` : ''}`
    case 'logs.synced': {
      const results = Array.isArray(d.results)
        ? (d.results as { console: string; ok: boolean }[])
        : []
      const failed = results.filter((r) => !r.ok).map((r) => r.console)
      return failed.length
        ? `${results.length} console, gagal: ${failed.join(', ')}`
        : `${results.length} console, semua berhasil`
    }
    default:
      return ''
  }
}
