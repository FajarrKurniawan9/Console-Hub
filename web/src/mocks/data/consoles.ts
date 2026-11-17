import type { ConsoleResource, ConsoleStatus, HubConsole } from '../../lib/schemas'
import { getScenario } from '../scenarios'

interface ConsoleSeed {
  id: number
  slug: string
  name: string
  base_url: string
  auth_type: HubConsole['auth_type']
  latency: number
  status: ConsoleStatus
  resources: ConsoleResource[]
}

export const consoleSeeds: ConsoleSeed[] = [
  {
    id: 1,
    slug: 'hr',
    name: 'Web HR',
    base_url: 'http://localhost:4001',
    auth_type: 'api_key',
    latency: 120,
    status: 'ok',
    resources: [
      {
        key: 'employees',
        label: 'Karyawan',
        writable_fields: ['name', 'division_id', 'role', 'status'],
      },
    ],
  },
  {
    id: 2,
    slug: 'gudang',
    name: 'Web Gudang',
    base_url: 'http://localhost:4002',
    auth_type: 'bearer',
    latency: 2430,
    status: 'slow',
    resources: [
      { key: 'items', label: 'Master barang', writable_fields: ['name', 'unit', 'min_stock'] },
    ],
  },
  {
    id: 3,
    slug: 'produksi',
    name: 'Web Produksi',
    base_url: 'http://localhost:4003',
    auth_type: 'basic',
    latency: 310,
    status: 'ok',
    resources: [{ key: 'prices', label: 'Harga', writable_fields: ['price_idr'] }],
  },
]

// Fixed moment the console went down, so "sejak" stays stable across polls.
export const DOWN_SINCE = new Date(Date.now() - 23 * 60_000).toISOString()
const lastCheck = new Map<string, string>()

export function isDown(slug: string) {
  const s = getScenario()
  return s === 'all-down' || (s === 'gudang-down' && slug === 'gudang')
}

export const DOWN_ERROR = (c: { base_url: string }) =>
  `connect ECONNREFUSED ${c.base_url.replace('http://', '')}`

export function touchCheck(slug: string) {
  lastCheck.set(slug, new Date().toISOString())
}

export function consoleView(seed: ConsoleSeed): HubConsole {
  const down = isDown(seed.slug)
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    base_url: seed.base_url,
    auth_type: seed.auth_type,
    status: down ? 'down' : seed.status,
    last_latency_ms: down ? null : seed.latency,
    last_checked_at: lastCheck.get(seed.slug) ?? new Date(Date.now() - 20_000).toISOString(),
    last_error: down ? DOWN_ERROR(seed) : null,
    down_since: down ? DOWN_SINCE : null,
    resources: seed.resources,
  }
}

export const consoleBySlug = (slug: string) => consoleSeeds.find((c) => c.slug === slug)
export const consoleById = (id: number) => consoleSeeds.find((c) => c.id === id)
