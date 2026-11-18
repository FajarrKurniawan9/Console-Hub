import type { ConsoleInfo, ConsoleSlug, ConsoleStatus } from '../../src/lib/api/schemas'
import { getScenario } from '../scenarios'

interface ConsoleSeed {
  id: number
  slug: ConsoleSlug
  name: string
  base_url: string
  latency: number
  status: ConsoleStatus
}

export const consoleSeeds: ConsoleSeed[] = [
  {
    id: 1,
    slug: 'hr',
    name: 'HR',
    base_url: 'http://localhost:4001',
    latency: 120,
    status: 'ok',
  },
  {
    id: 2,
    slug: 'gudang',
    name: 'Gudang',
    base_url: 'http://localhost:4002',
    latency: 2430,
    status: 'slow',
  },
  {
    id: 3,
    slug: 'produksi',
    name: 'Produksi',
    base_url: 'http://localhost:4003',
    latency: 310,
    status: 'ok',
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

export function consoleView(seed: ConsoleSeed): ConsoleInfo {
  const down = isDown(seed.slug)
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    base_url: seed.base_url,
    status: down ? 'down' : seed.status,
    last_latency_ms: down ? null : seed.latency,
    last_checked_at: lastCheck.get(seed.slug) ?? new Date(Date.now() - 20_000).toISOString(),
    last_error: down ? DOWN_ERROR(seed) : null,
  }
}

export const consoleBySlug = (slug: ConsoleSlug) => consoleSeeds.find((c) => c.slug === slug)
export const consoleById = (id: number) => consoleSeeds.find((c) => c.id === id)
