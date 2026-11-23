// Fake hub for component tests: replaces the axios adapter, so `request()` (auth header, zod parsing,
// error mapping) runs for real. Each test lists the responses it needs; unlisted calls fail loudly.
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach } from 'vitest'
import { http } from '../lib/api/client'
import type { AuthUser, ConsoleInfo, Item, Person, Production } from '../lib/api/schemas'

export type Call = {
  method: string
  url: string
  params: URLSearchParams
  body: unknown
  headers: Record<string, unknown>
}
type Reply = { status?: number; body?: unknown; delay?: number } | 'network-error'
type Handler = Reply | ((call: Call) => Reply)

const routes: { method: string; path: RegExp | string; handler: Handler }[] = []
/** Every request the app made, in order. */
export const calls: Call[] = []

/**
 * Answer `METHOD /path` (path relative to /api/v1, without query). Later routes win, so a test can
 * override the defaults from `signedIn()`. A RegExp path matches the whole path.
 */
export function on(route: string, handler: Handler) {
  const [method, path] = route.split(' ') as [string, string]
  routes.unshift({
    method,
    path: path.includes('*') ? new RegExp(`^${path.replace(/\*/g, '[^/]+')}$`) : path,
    handler,
  })
}

export const ok = (data: unknown, status = 200): Reply => ({ status, body: { data } })
export const page = (data: unknown[], meta: Record<string, unknown> = {}): Reply => ({
  body: { data, meta: { next_cursor: null, ...meta } },
})
export const fail = (status: number, code: string, message = code, details?: unknown): Reply => ({
  status,
  body: { error: { code, message, ...(details ? { details } : {}) } },
})

const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const url = new URL(config.url ?? '', 'http://hub')
  const params = new URLSearchParams(url.search)
  const extra = config.params as URLSearchParams | Record<string, string> | undefined
  if (extra)
    new URLSearchParams(extra as Record<string, string>).forEach((v, k) => params.set(k, v))
  const call: Call = {
    method: (config.method ?? 'get').toUpperCase(),
    url: url.pathname,
    params,
    body: typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? null),
    headers: config.headers.toJSON(),
  }
  calls.push(call)

  const route = routes.find(
    (r) =>
      r.method === call.method &&
      (typeof r.path === 'string' ? r.path === call.url : r.path.test(call.url)),
  )
  const reply = route
    ? typeof route.handler === 'function'
      ? route.handler(call)
      : route.handler
    : fail(500, 'SERVER_ERROR', `No fake for ${call.method} ${call.url}`)

  if (reply === 'network-error') throw new AxiosError('Network Error', 'ERR_NETWORK', config)
  if (reply.delay) await new Promise((r) => setTimeout(r, reply.delay))
  const response = {
    data: reply.body ?? '',
    status: reply.status ?? 200,
    statusText: '',
    headers: new AxiosHeaders(),
    config,
  }
  if (response.status >= 400)
    throw new AxiosError(`HTTP ${response.status}`, 'ERR_BAD_RESPONSE', config, null, response)
  return response
}

const realAdapter = http.defaults.adapter
beforeEach(() => {
  routes.length = 0
  calls.length = 0
  http.defaults.adapter = adapter
})
afterEach(() => {
  http.defaults.adapter = realAdapter
})

// ---- fixtures (shapes from schemas.ts)

const ADMIN_PERMS = [
  'barang.view',
  'barang.create',
  'barang.update',
  'barang.delete',
  'produksi.view',
  'produksi.create',
  'produksi.update',
  'produksi.delete',
  'personel.view',
  'personel.create',
  'personel.update',
  'personel.delete',
  'lacak.view',
  'dashboard.view',
  'admin.dashboard.view',
  'admin.logs.view',
  'admin.consoles.view',
  'admin.consoles.manage',
  'admin.rbac.manage',
  'admin.audit.view',
]
const USER_PERMS = [
  'barang.view',
  'barang.create',
  'barang.update',
  'produksi.view',
  'produksi.create',
  'produksi.update',
  'personel.view',
  'lacak.view',
]

export const users = {
  admin: {
    id: 1,
    name: 'Rina Wulandari',
    email: 'admin@example.com',
    role: { code: 'admin_it', name: 'Admin IT' },
    permissions: ADMIN_PERMS,
  },
  user: {
    id: 2,
    name: 'Budi Santoso',
    email: 'user@example.com',
    role: { code: 'user', name: 'User' },
    permissions: USER_PERMS,
  },
  manajer: {
    id: 3,
    name: 'Hendra Wijaya',
    email: 'manajer@example.com',
    role: { code: 'manajer_gudang', name: 'Manajer Gudang' },
    permissions: [
      'barang.view',
      'barang.create',
      'barang.update',
      'barang.delete',
      'lacak.view',
      'dashboard.view',
    ],
  },
  produksi: {
    id: 4,
    name: 'Agus Santoso',
    email: 'produksi@example.com',
    role: { code: 'staff_produksi', name: 'Staff Produksi' },
    permissions: [
      'produksi.view',
      'produksi.create',
      'produksi.update',
      'produksi.delete',
      'lacak.view',
    ],
  },
  hr: {
    id: 5,
    name: 'Siti Rahma',
    email: 'hr@example.com',
    role: { code: 'staff_hr', name: 'Staff HR' },
    permissions: ['personel.view', 'personel.create', 'personel.update', 'personel.delete'],
  },
  auditor: {
    id: 6,
    name: 'Dewi Lestari',
    email: 'auditor@example.com',
    role: { code: 'auditor', name: 'Auditor' },
    permissions: [
      'barang.view',
      'produksi.view',
      'personel.view',
      'lacak.view',
      'dashboard.view',
      'admin.audit.view',
    ],
  },
} satisfies Record<string, AuthUser>

const stamps = {
  status: 'aktif' as const,
  version: 1,
  created_at: '2026-11-19T01:00:00Z',
  updated_at: '2026-11-19T01:00:00Z',
}

export const joko: Person = { id: 'p-joko', name: 'Joko Susilo', role: 'Staf Gudang', ...stamps }
export const dedi: Person = { id: 'p-dedi', name: 'Dedi Kurniawan', role: 'Kurir', ...stamps }
export const hendra: Person = {
  id: 'p-hendra',
  name: 'Hendra Gunawan',
  role: 'Supervisor Distribusi',
  ...stamps,
}
const ref = ({ id, name, role }: Person) => ({ id, name, role })

export const tenun: Production = {
  id: 'pr-tenun',
  area: 'Area Tekstil A',
  production_type: 'Tenun',
  courier_id: dedi.id,
  courier: ref(dedi),
  ...stamps,
}
export const pewarnaan: Production = {
  id: 'pr-warna',
  area: 'Area Tekstil A',
  production_type: 'Pewarnaan',
  courier_id: null,
  courier: null,
  ...stamps,
}

export const kain: Item = {
  id: 'i-kain',
  name: 'Kain katun',
  kind: 'kain',
  production_id: tenun.id,
  production: { id: tenun.id, area: tenun.area, production_type: tenun.production_type },
  responsible_id: joko.id,
  responsible: ref(joko),
  quantity: 340,
  unit: 'm',
  ...stamps,
}
export const kardus: Item = {
  id: 'i-kardus',
  name: 'Kardus kemasan besar',
  kind: 'kemasan',
  production_id: null,
  production: null,
  responsible_id: null,
  responsible: null,
  quantity: 400,
  unit: 'pcs',
  ...stamps,
}

export const sources = (down: string[] = []): ConsoleInfo[] =>
  (['hr', 'gudang', 'produksi'] as const).map((slug, i) => ({
    id: i + 1,
    slug,
    name: { hr: 'HR', gudang: 'Gudang', produksi: 'Produksi' }[slug],
    base_url: `https://${slug}.example`,
    is_active: true,
    status: down.includes(slug) ? 'down' : 'ok',
    latency_ms: down.includes(slug) ? null : 120,
    last_checked_at: '2026-11-19T02:00:00Z',
  }))

/** Signed in as `who`, with the calls every page makes (me, source list, work lists). */
export function signedIn(who: keyof typeof users) {
  on('GET /auth/me', ok(users[who]))
  on('GET /admin/consoles', page(sources()))
  on('GET /items', page([kain, kardus]))
  on('GET /productions', page([tenun, pewarnaan]))
  on('GET /people', page([joko, dedi, hendra]))
}
