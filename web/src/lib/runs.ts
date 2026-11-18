import type { Run, RunStep } from './schemas'

export const isFinalStatus = (s: Run['status']) =>
  s === 'succeeded' || s === 'failed' || s === 'canceled'
export const canCancel = (r: Run) => r.status === 'queued' || r.status === 'running'

const COMPENSATED = new Set<RunStep['status']>(['compensated', 'compensation_failed'])

/**
 * Retry is only offered for failed runs.
 * - from_failed: nothing was undone, so resume at the failed step.
 * - from_start: earlier steps were compensated (undone), so the whole process runs again.
 */
export function retryMode(r: Run): 'from_failed' | 'from_start' | null {
  if (r.status !== 'failed' || !r.steps) return null
  return r.steps.some((s) => COMPENSATED.has(s.status)) ? 'from_start' : 'from_failed'
}

export interface Shortage {
  sku: string
  name?: string
  needed: number
  available: number
  unit?: string
}

/** Pull `details` out of a failed step's response body (portal ApiError or console error shape). */
export function stepDetails(step: RunStep): Record<string, unknown> | null {
  const body = step.response?.body
  if (!body || typeof body !== 'object') return null
  const err = (body as { error?: { details?: unknown } }).error
  const details = err?.details ?? (body as { details?: unknown }).details
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : null
}

export function shortagesOf(step: RunStep): Shortage[] | null {
  const list = stepDetails(step)?.shortages
  if (!Array.isArray(list)) return null
  return list.filter(
    (x): x is Shortage =>
      !!x &&
      typeof x === 'object' &&
      typeof x.sku === 'string' &&
      typeof x.needed === 'number' &&
      typeof x.available === 'number',
  )
}
