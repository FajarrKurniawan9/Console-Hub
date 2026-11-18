import { describe, expect, it } from 'vitest'
import { canCancel, retryMode, shortagesOf } from './runs'
import type { Run, RunStep } from './schemas'

const step = (status: RunStep['status'], extra: Partial<RunStep> = {}): RunStep => ({
  position: 1,
  name: 'x',
  console: { slug: 'gudang' },
  status,
  attempt: 1,
  ...extra,
})
const run = (status: Run['status'], steps: RunStep[]): Run => ({
  id: 'run_1',
  process: { id: 1, name: 'p' },
  status,
  input: {},
  triggered_by: { id: 1, name: 'a' },
  created_at: '2026-11-17T00:00:00Z',
  started_at: null,
  finished_at: null,
  error_summary: null,
  retry_of: null,
  steps,
})

describe('run rules', () => {
  it('only queued and running can be canceled', () => {
    expect(canCancel(run('queued', []))).toBe(true)
    expect(canCancel(run('running', []))).toBe(true)
    for (const s of ['succeeded', 'failed', 'canceled'] as const)
      expect(canCancel(run(s, []))).toBe(false)
  })

  it('retry: none unless failed; from start after compensation; else from the failed step', () => {
    expect(retryMode(run('succeeded', [step('succeeded')]))).toBeNull()
    expect(retryMode(run('canceled', [step('skipped')]))).toBeNull()
    expect(retryMode(run('failed', [step('succeeded'), step('failed')]))).toBe('from_failed')
    expect(retryMode(run('failed', [step('compensated'), step('failed')]))).toBe('from_start')
    expect(retryMode(run('failed', [step('compensation_failed'), step('failed')]))).toBe(
      'from_start',
    )
  })

  it('reads stock shortages from an ApiError-shaped response body', () => {
    const s = step('failed', {
      response: {
        status: 409,
        body: {
          error: {
            code: 'INSUFFICIENT_STOCK',
            details: { shortages: [{ sku: 'SKU-BB-001', needed: 600, available: 180 }] },
          },
        },
      },
    })
    expect(shortagesOf(s)).toEqual([{ sku: 'SKU-BB-001', needed: 600, available: 180 }])
    expect(shortagesOf(step('failed'))).toBeNull()
  })
})
