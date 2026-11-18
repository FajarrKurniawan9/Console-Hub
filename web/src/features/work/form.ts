import type { WriteOutcome } from './useWrite'

/** First message for `name` from a 422, if any. */
export function fieldError(outcome: WriteOutcome, name: string) {
  return outcome.kind === 'error' && outcome.error.code === 'VALIDATION_FAILED'
    ? outcome.error.fields[name]?.[0]
    : undefined
}

export const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
/** Empty input → NaN, so the server (or the mock) reports it instead of silently sending 0. */
export const numeric = (f: FormData, k: string) => {
  const v = text(f, k).replace(/\./g, '')
  return v === '' ? NaN : Number(v)
}

/** Only the fields that changed, plus `expected_version`, for a PATCH. */
export function changed<T extends Record<string, unknown>>(
  before: Record<string, unknown>,
  after: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(after).filter(([k, v]) => JSON.stringify(before[k]) !== JSON.stringify(v)),
  ) as Partial<T>
}
