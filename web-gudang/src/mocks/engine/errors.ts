import type { ErrorCode } from '../../lib/api/types'

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  VERSION_CONFLICT: 409,
  LOCKED: 409,
  RACK_NOT_EMPTY: 409,
  DUPLICATE_CODE: 409,
  ITEM_INACTIVE: 409,
  RACK_INACTIVE: 409,
  INSUFFICIENT_STOCK: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
}

/** Dilempar engine; handler mengubahnya menjadi ApiErrorBody dengan status HTTP di atas. */
export class MockFail extends Error {
  code: ErrorCode
  details?: Record<string, unknown>
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
  }
}

export const invalid = (fields: Record<string, string>) =>
  new MockFail('VALIDATION_ERROR', 'Ada isian yang belum benar.', {
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [v]])),
  })
