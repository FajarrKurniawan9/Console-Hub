import type { ConsistencyCheck } from '../../src/lib/api/schemas'
import { getScenario } from '../scenarios'

// Phase 3: history only, for the overview. Running checks and repairs arrive in phase 4.
const DAY = 86_400_000
const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()

export const checks: ConsistencyCheck[] = [
  {
    id: 1,
    entity_type: 'divisi',
    status: 'clean',
    checked_count: 4,
    drift_count: 0,
    started_at: at(5 * DAY),
    finished_at: at(5 * DAY - 4000),
  },
  {
    id: 2,
    entity_type: 'barang',
    status: 'drift',
    checked_count: 15,
    drift_count: 2,
    started_at: at(2 * DAY),
    finished_at: at(2 * DAY - 9000),
  },
  {
    id: 3,
    entity_type: 'karyawan',
    status: 'clean',
    checked_count: 12,
    drift_count: 0,
    started_at: at(6 * 3_600_000),
    finished_at: at(6 * 3_600_000 - 7000),
  },
]

export function latestCheck() {
  if (getScenario() === 'empty') return null
  return structuredClone(
    [...checks].sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null,
  )
}
