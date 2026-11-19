import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { apiErrorBody, type ErrorCode } from './schemas'

const TOKEN_KEY = 'ch.token'
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
      // Storage blocked; the token lives in memory for this tab only.
    }
  },
  clear: () => {
    memoryToken = null
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      // Nothing stored.
    }
  },
}

// NETWORK: no response at all. CONTRACT_MISMATCH: response did not match the schema.
export type ClientErrorCode = ErrorCode | 'NETWORK' | 'CONTRACT_MISMATCH'

export class ApiError extends Error {
  code: ClientErrorCode
  status: number
  fields: Record<string, string[]>
  details?: Record<string, unknown>

  constructor(
    code: ClientErrorCode,
    message: string,
    status: number,
    extra: {
      fields?: Record<string, string[]>
      details?: Record<string, unknown>
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fields = extra.fields ?? {}
    this.details = extra.details
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? 0
    if (!err.response) return new ApiError('NETWORK', 'Tidak dapat terhubung ke server portal.', 0)
    const parsed = apiErrorBody.safeParse(err.response.data)
    if (parsed.success) {
      const { code, message, details } = parsed.data.error
      return new ApiError(code, message, status, { fields: fieldsOf(details), details })
    }
    return new ApiError(
      'CONTRACT_MISMATCH',
      `Respons error tidak dikenal (HTTP ${status}).`,
      status,
    )
  }
  return new ApiError('NETWORK', err instanceof Error ? err.message : String(err), 0)
}

/**
 * `details.fields` per field. 422 VALIDATION_ERROR sends `{field: [messages]}`;
 * REFERENCE_NOT_FOUND may send just the field names, which get no message of their own.
 */
function fieldsOf(details: Record<string, unknown> | undefined): Record<string, string[]> {
  const f = details?.fields
  if (Array.isArray(f)) return Object.fromEntries(f.map((k) => [String(k), []]))
  if (!f || typeof f !== 'object') return {}
  return Object.fromEntries(
    Object.entries(f).map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).map(String)]),
  )
}

let onUnauthenticated = () => {}
export function setUnauthenticatedHandler(fn: () => void) {
  onUnauthenticated = fn
}

let onForbidden = () => {}
/** A 403 usually means our copy of the permissions is stale; the auth layer reloads `me`. */
export function setForbiddenHandler(fn: () => void) {
  onForbidden = fn
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * Single entry point for the portal API: auth header, zod validation, typed errors, 401 handling.
 * 403 is thrown as `ApiError('FORBIDDEN')` and shown by the caller (route guards already hide
 * what the user cannot do).
 */
export async function request<S extends z.ZodType>(
  schema: S,
  config: AxiosRequestConfig,
): Promise<z.infer<S>> {
  let data: unknown
  try {
    data = (await http.request(config)).data
  } catch (err) {
    const e = toApiError(err)
    if (e.status === 401 && config.url !== '/auth/login') {
      tokenStore.clear()
      onUnauthenticated()
    }
    if (e.status === 403 && config.url !== '/auth/login' && config.url !== '/auth/me') onForbidden()
    throw e
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error('Contract mismatch', config.url, parsed.error.issues)
    throw new ApiError('CONTRACT_MISMATCH', `Respons ${config.url} tidak sesuai kontrak API.`, 200)
  }
  return parsed.data
}

/** Strip empty values so filters do not send `?level=`. */
export function params(input: Record<string, string | number | string[] | null | undefined>) {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v)) {
      if (v.length) out.set(k, v.join(','))
    } else out.set(k, String(v))
  }
  return out
}
