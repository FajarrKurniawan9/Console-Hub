import { delay, http, HttpResponse, type JsonBodyType } from 'msw'
import type { z } from 'zod'
import { dataOf, pagedOf } from '../lib/api/schemas'
import type { ApiErrorBody, ErrorCode } from '../lib/api/types'
import { MOCK_ACCOUNT } from './fixtures/catalog'
import { HTTP_STATUS, MockFail } from './engine/errors'
import { getScenario, mockConfig } from './scenarios'

export const base = `${import.meta.env.VITE_API_URL ?? ''}`.replace(/\/$/, '')
export const url = (path: string) => `${base}${path}`

export function fail(code: ErrorCode, message: string, details?: Record<string, unknown>) {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } }
  return HttpResponse.json(body, { status: HTTP_STATUS[code] })
}

/**
 * Respons mock divalidasi dengan skema yang sama dengan klien. Menyimpang dari kontrak
 * = galat keras di mock, bukan data salah yang diam-diam lolos ke UI.
 */
function checked<S extends z.ZodType>(schema: S, body: unknown) {
  const r = schema.safeParse(body)
  if (!r.success) throw new Error(`Mock menyimpang dari kontrak: ${JSON.stringify(r.error.issues.slice(0, 3))}`)
  return body as JsonBodyType
}

export const one = <S extends z.ZodType>(schema: S, data: unknown, status = 200) =>
  HttpResponse.json(checked(dataOf(schema), { data }), { status })

const PAGE = 50
export function paged<S extends z.ZodType>(schema: S, rows: unknown[], request: Request) {
  const cursor = Number(new URL(request.url).searchParams.get('cursor') ?? 0) || 0
  const slice = getScenario() === 'empty' ? [] : rows.slice(cursor, cursor + PAGE)
  const next = getScenario() !== 'empty' && cursor + PAGE < rows.length ? String(cursor + PAGE) : null
  return HttpResponse.json(checked(pagedOf(schema), { data: slice, meta: { next_cursor: next } }))
}

export const query = (request: Request) => {
  const out: Record<string, string> = {}
  new URL(request.url).searchParams.forEach((v, k) => {
    if (v !== '' && k !== 'cursor') out[k] = v
  })
  return out
}

export async function latency() {
  if (mockConfig.instant) return
  if (getScenario() === 'slow') await delay(1500 + Math.random() * 1500)
  else await delay(120 + Math.random() * 200)
}

// Token mock: `mock-<id>-<acak>`; diterima juga setelah muat ulang (state memori hilang).
export const issueToken = () => `mock-${MOCK_ACCOUNT.id}-${Math.random().toString(36).slice(2)}`
const bearer = (r: Request) => r.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''

/** Sesi + skenario global. Mengembalikan respons galat, atau nama staf yang login. */
export function guard(request: Request): Response | string {
  const s = getScenario()
  if (s === 'unauthenticated' || !bearer(request).startsWith(`mock-${MOCK_ACCOUNT.id}-`))
    return fail('UNAUTHENTICATED', 'Sesi tidak valid atau sudah berakhir.')
  if (s === 'server-error') return fail('SERVER_ERROR', 'Terjadi galat di server gudang.')
  return MOCK_ACCOUNT.name
}

type Ctx = { request: Request; params: Record<string, string | readonly string[] | undefined>; actor: string }
type Method = 'get' | 'post' | 'patch'

/** Route terlindung: latensi, guard sesi/skenario, MockFail → ApiErrorBody. */
export function route(method: Method, path: string, fn: (ctx: Ctx) => Response | Promise<Response>) {
  return http[method](url(path), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (typeof g !== 'string') return g
    try {
      return await fn({ request, params, actor: g })
    } catch (e) {
      if (e instanceof MockFail) return fail(e.code, e.message, e.details)
      throw e
    }
  })
}

export async function json(request: Request): Promise<Record<string, unknown>> {
  const b: unknown = await request.json().catch(() => null)
  return b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
}
