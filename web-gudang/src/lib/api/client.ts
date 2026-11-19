import type { z } from 'zod'
import { apiErrorBody } from './schemas'
import type { ErrorCode } from './types'

const TOKEN_KEY = 'gudang.token'
let memoryToken: string | null = null

function readStored() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const tokenStore = {
  get: () => memoryToken ?? (memoryToken = readStored()),
  set: (token: string) => {
    memoryToken = token
    try {
      sessionStorage.setItem(TOKEN_KEY, token)
    } catch {
      // Storage diblokir; token hanya hidup di memori tab ini.
    }
  },
  clear: () => {
    memoryToken = null
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      // Tidak ada yang disimpan.
    }
  },
}

// NETWORK: tidak ada respons. CONTRACT_MISMATCH: respons tidak sesuai skema.
export type ClientErrorCode = ErrorCode | 'NETWORK' | 'CONTRACT_MISMATCH'

export class ApiError extends Error {
  code: ClientErrorCode
  status: number
  details?: Record<string, unknown>

  constructor(code: ClientErrorCode, message: string, status: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }

  /** Galat per field dari `details.fields` (422 VALIDATION_ERROR). */
  get fields(): Record<string, string> {
    const raw = this.details?.fields
    if (!raw || typeof raw !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      const first = Array.isArray(v) ? v[0] : v
      if (typeof first === 'string') out[k] = first
    }
    return out
  }
}

let onUnauthenticated = () => {}
export function setUnauthenticatedHandler(fn: () => void) {
  onUnauthenticated = fn
}

/** UUID baru per aksi pengguna; kirim ulang kunci yang sama bila aksi yang sama dicoba lagi. */
export const newIdempotencyKey = () => crypto.randomUUID()

const BASE = `${import.meta.env.VITE_API_URL ?? ''}`.replace(/\/$/, '')

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  idempotencyKey?: string
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === null || v === undefined || v === '' || v === false) continue
    qs.set(k, String(v))
  }
  const s = qs.toString()
  // Relatif terhadap origin bila BASE bukan URL absolut (mis. /api/v1 saat mock).
  return `${BASE}${path}${s ? `?${s}` : ''}`
}

/**
 * Satu-satunya pintu ke API: header token, validasi Zod, galat bertipe, 401 → keluar.
 */
export async function request<S extends z.ZodType>(
  schema: S,
  path: string,
  { method = 'GET', body, query, idempotencyKey, signal }: RequestOptions = {},
): Promise<z.infer<S>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  let res: Response
  try {
    res = await fetch(new URL(buildUrl(path, query), window.location.origin), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('NETWORK', 'Tidak dapat terhubung ke server gudang.', 0)
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null)

  if (!res.ok) {
    const parsed = apiErrorBody.safeParse(data)
    const e = parsed.success
      ? new ApiError(parsed.data.error.code, parsed.data.error.message, res.status, parsed.data.error.details)
      : new ApiError(res.status === 401 ? 'UNAUTHENTICATED' : 'SERVER_ERROR', `Server membalas galat (HTTP ${res.status}).`, res.status)
    if (res.status === 401 && path !== '/auth/login') {
      tokenStore.clear()
      onUnauthenticated()
    }
    throw e
  }

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error('Kontrak tidak cocok', path, parsed.error.issues)
    throw new ApiError('CONTRACT_MISMATCH', 'Data dari server tidak sesuai format yang diharapkan.', res.status)
  }
  return parsed.data
}
