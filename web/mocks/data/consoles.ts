import type { ConsoleInfo, ConsoleStatus, Source } from '../../src/lib/api/schemas'
import { getScenario } from '../scenarios'

interface ConsoleSeed {
  id: number
  slug: Source
  name: string
  base_url: string
  latency: number
  status: ConsoleStatus
}

// Dev ports from kontrak-3-api §1 (HR 9101, Gudang 9102, Produksi 9103).
export const consoleSeeds: ConsoleSeed[] = [
  { id: 1, slug: 'hr', name: 'HR', base_url: 'http://localhost:9101', latency: 120, status: 'ok' },
  {
    id: 2,
    slug: 'gudang',
    name: 'Gudang',
    base_url: 'http://localhost:9102',
    latency: 180,
    status: 'ok',
  },
  {
    id: 3,
    slug: 'produksi',
    name: 'Produksi',
    base_url: 'http://localhost:9103',
    latency: 310,
    status: 'ok',
  },
]

// Fixed moment the source went down, so "sejak" stays stable across polls.
export const DOWN_SINCE = new Date(Date.now() - 23 * 60_000).toISOString()
const lastCheck = new Map<string, string>()

const DOWN_IN: Record<string, Source[]> = {
  'hr-down': ['hr'],
  'produksi-down': ['produksi'],
  'gudang-down': ['gudang'],
  'all-down': ['hr', 'gudang', 'produksi'],
}

export function isDown(slug: Source) {
  return DOWN_IN[getScenario()]?.includes(slug) ?? false
}

/** `slow-source`: one source answers after 3 s. */
export const SLOW_SOURCE: Source = 'hr'
export const isSlow = (slug: Source) => getScenario() === 'slow-source' && slug === SLOW_SOURCE

export const DOWN_ERROR = (c: { base_url: string }) =>
  `connect ECONNREFUSED ${c.base_url.replace('http://', '')}`

export function touchCheck(slug: string) {
  lastCheck.set(slug, new Date().toISOString())
}

export function consoleView(seed: ConsoleSeed): ConsoleInfo {
  const down = isDown(seed.slug)
  const slow = isSlow(seed.slug)
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    base_url: seed.base_url,
    is_active: true,
    status: down ? 'down' : slow ? 'slow' : seed.status,
    latency_ms: down ? null : slow ? 3000 : seed.latency,
    last_checked_at: lastCheck.get(seed.slug) ?? new Date(Date.now() - 20_000).toISOString(),
  }
}

export const consoleBySlug = (slug: Source) => consoleSeeds.find((c) => c.slug === slug)!
export const consoleById = (id: number) => consoleSeeds.find((c) => c.id === id)
