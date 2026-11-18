import { delay, HttpResponse, type JsonBodyType } from 'msw'
import type { ApiErrorBody, ErrorCode, Permission } from '../src/lib/api/schemas'
import { can, users } from './data/users'
import { getScenario, mockConfig } from './scenarios'

export const base = `${import.meta.env.VITE_API_URL}`.replace(/\/$/, '')
export const url = (path: string) => `${base}${path}`

const HTTP: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TRANSACTION_REFUSED: 409,
  VERSION_CONFLICT: 409,
  LOCKED: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  CONSOLE_ERROR: 502,
  CONSOLE_UNREACHABLE: 502,
  CONSOLE_TIMEOUT: 504,
}

export function fail(
  code: ErrorCode,
  message: string,
  extra: Omit<ApiErrorBody['error'], 'code' | 'message'> = {},
) {
  return HttpResponse.json<ApiErrorBody>(
    { error: { code, message, ...extra } },
    { status: HTTP[code] },
  )
}

export const ok = (data: JsonBodyType, status = 200) => HttpResponse.json(data, { status })

export const page = <T extends JsonBodyType>(
  data: T[],
  next_cursor: string | null = null,
  total: number | null = null,
) => HttpResponse.json({ data, meta: { next_cursor, total } } as JsonBodyType)

/** Scenario latency. `slow` adds 1–4 s; the default adds a little so skeletons are visible. */
export async function latency() {
  if (mockConfig.instant) return
  if (getScenario() === 'slow') await delay(1000 + Math.random() * 3000)
  else await delay(150 + Math.random() * 250)
}

const tokens = new Map<string, number>()
export function issueToken(userId: number) {
  const token = `mock-${userId}-${Math.random().toString(36).slice(2)}`
  tokens.set(token, userId)
  return token
}
export function revokeToken(request: Request) {
  tokens.delete(bearer(request) ?? '')
}
const bearer = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer /, '')

/** Resolves the user or returns an error response (401 / 403 / 429 per scenario and permission). */
export function guard(request: Request, perm?: Permission) {
  const scenario = getScenario()
  if (scenario === 'unauthenticated') {
    return { error: fail('UNAUTHENTICATED', 'Sesi tidak valid atau sudah berakhir.') }
  }
  const token = bearer(request)
  // Tokens survive a page reload in sessionStorage but not the mock's memory; accept mock-<id>-* tokens.
  const id = token ? (tokens.get(token) ?? Number(/^mock-(\d+)-/.exec(token)?.[1])) : NaN
  const user = users.find((u) => u.id === id && u.is_active)
  if (!user) return { error: fail('UNAUTHENTICATED', 'Token tidak ada atau tidak valid.') }
  if (perm && !can(user, perm))
    return { error: fail('FORBIDDEN', 'Anda tidak memiliki izin untuk tindakan ini.') }
  if (scenario === 'rate-limited' && Math.random() < 0.3) {
    return {
      error: fail(
        'RATE_LIMITED',
        'Batas 60 permintaan per menit terlampaui. Coba lagi dalam 10 detik.',
      ),
    }
  }
  return { user }
}
