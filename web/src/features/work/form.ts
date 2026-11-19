import { fieldMessage } from '../../lib/errors'
import type { WriteOutcome } from './useWrite'

/** Message for `name` from a 422 (VALIDATION_ERROR or REFERENCE_NOT_FOUND), if any. */
export function fieldError(outcome: WriteOutcome, name: string) {
  return outcome.kind === 'error' ? fieldMessage(outcome.error, name) : undefined
}

export const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
/** Empty select → null, so a reference can be cleared. */
export const optional = (f: FormData, k: string) => text(f, k) || null
/** Empty input → NaN, so the server (or the mock) reports it instead of silently sending 0. */
export const numeric = (f: FormData, k: string) => {
  const v = text(f, k).replace(/\./g, '')
  return v === '' ? NaN : Number(v)
}

/** Only the fields that changed, for a PATCH (the caller adds `expected_version`). */
export function changed<T extends Record<string, unknown>>(
  before: Record<string, unknown>,
  after: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(after).filter(([k, v]) => JSON.stringify(before[k]) !== JSON.stringify(v)),
  ) as Partial<T>
}
