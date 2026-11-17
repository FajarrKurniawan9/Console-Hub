import type { HubProcess, Run, RunStep, StepStatus } from '../../lib/schemas'
import { retryMode } from '../../lib/runs'
import { getScenario, mockConfig } from '../scenarios'
import { consoleBySlug, isDown } from './consoles'
import { PEOPLE } from './people'
import { findProcess } from './processes'
import { pad, seeded } from './random'
import { users } from './users'

export const runs: Run[] = []
const timers = new Map<string, ReturnType<typeof setTimeout>[]>()

const FINAL = new Set(['succeeded', 'failed', 'canceled'])
export const isFinal = (r: Run) => FINAL.has(r.status)

let seq = 0
const newId = (at: number) => {
  seq += 1
  return `run_${new Date(at).toISOString().slice(0, 10).replace(/-/g, '')}_${pad(seq, 4)}`
}

const shortages = (qty: number) => [
  { sku: 'SKU-BB-001', name: 'Tepung terigu', needed: qty * 4, available: 180, unit: 'kg' },
  { sku: 'SKU-BB-002', name: 'Gula pasir', needed: qty * 2, available: 95, unit: 'kg' },
]

function stepUrl(proc: HubProcess, pos: number, input: Record<string, unknown>) {
  const s = proc.steps[pos - 1]!
  const base = consoleBySlug(s.console.slug)!.base_url
  return `${base}${s.path.replace('{nik}', String(input.nik ?? ''))}`
}

function requestBody(proc: HubProcess, pos: number, input: Record<string, unknown>): unknown {
  if (proc.id === 1) {
    if (pos === 1) return { customer: input.customer, sku: input.sku, qty: input.qty }
    if (pos === 2)
      return {
        order_ref: 'PO-2026-0071',
        materials: [
          { sku: 'SKU-BB-001', qty: Number(input.qty) * 4 },
          { sku: 'SKU-BB-002', qty: Number(input.qty) * 2 },
        ],
      }
    return { order_ref: 'PO-2026-0071', priority: 'normal' }
  }
  if (proc.id === 2) {
    if (pos === 1) return { name: input.name, division: input.division, role: input.role }
    if (pos === 2) return { employee: 'E-013', areas: ['A', 'B'] }
    return { employee: 'E-013', shift: 'pagi' }
  }
  if (pos === 1) return { status: 'nonaktif', reason: input.reason ?? null }
  return undefined
}

function successBody(proc: HubProcess, pos: number): unknown {
  if (proc.id === 1)
    return [
      { id: 'PO-2026-0071', status: 'baru' },
      { id: 'RSV-2026-0412', status: 'reserved' },
      { position: 4 },
    ][pos - 1]
  if (proc.id === 2)
    return [{ nik: 'E-013' }, { granted: ['A', 'B'] }, { team: 'Shift Pagi B' }][pos - 1]
  return { ok: true }
}

type Outcome = { ok: true } | { ok: false; status: number; error: string; body: unknown }

/** Decide how a step ends, per scenario and input. */
function outcome(
  proc: HubProcess,
  pos: number,
  input: Record<string, unknown>,
  forced: 'stock' | 'timeout' | undefined,
  live: boolean,
): Outcome {
  const step = proc.steps[pos - 1]!
  const scenario = live ? getScenario() : 'ok'
  if (forced === 'timeout' && step.console.slug === 'gudang') {
    return {
      ok: false,
      status: 504,
      error: 'CONSOLE_TIMEOUT: Web Gudang tidak merespons dalam 10 detik',
      body: { error: { code: 'CONSOLE_TIMEOUT', console: 'gudang' } },
    }
  }
  if (live && isDown(step.console.slug)) {
    return {
      ok: false,
      status: 503,
      error: `CONSOLE_UNREACHABLE: ${step.console.name} tidak dapat dihubungi`,
      body: { error: { code: 'CONSOLE_UNREACHABLE', console: step.console.slug } },
    }
  }
  if (scenario === 'run-fails' && pos === 2) {
    return {
      ok: false,
      status: 500,
      error: `CONSOLE_ERROR: ${step.console.name} mengembalikan HTTP 500`,
      body: { message: 'Internal Server Error' },
    }
  }
  if (proc.id === 1 && pos === 2 && (forced === 'stock' || Number(input.qty) > 100)) {
    const s = shortages(Number(input.qty))
    return {
      ok: false,
      status: 409,
      error: 'INSUFFICIENT_STOCK: stok bahan baku tidak cukup untuk reservasi',
      body: {
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Stok bahan baku tidak cukup',
          details: { shortages: s },
        },
      },
    }
  }
  return { ok: true }
}

function blankSteps(proc: HubProcess): RunStep[] {
  return proc.steps.map((s) => ({
    position: s.position,
    name: s.name,
    console: { slug: s.console.slug },
    status: 'pending' as StepStatus,
    attempt: 0,
    error: null,
    duration_ms: null,
  }))
}

function summary(proc: HubProcess, pos: number, o: Exclude<Outcome, { ok: true }>) {
  return `Langkah ${pos} "${proc.steps[pos - 1]!.name}" gagal: ${o.error}`
}

/**
 * Run one process synchronously from step `from` (used for history) and return the
 * final state. Live runs use `simulate`, which plays the same transitions over time.
 */
function plan(
  proc: HubProcess,
  input: Record<string, unknown>,
  from: number,
  forced?: 'stock' | 'timeout',
  live = true,
) {
  const transitions: { pos: number; step: Partial<RunStep> }[] = []
  let failedAt: number | null = null
  let failure: Exclude<Outcome, { ok: true }> | null = null
  for (let pos = from; pos <= proc.steps.length; pos++) {
    const def = proc.steps[pos - 1]!
    const o = outcome(proc, pos, input, forced, live)
    const request = {
      method: def.method,
      url: stepUrl(proc, pos, input),
      body: requestBody(proc, pos, input),
    }
    if (o.ok) {
      transitions.push({
        pos,
        step: {
          status: 'succeeded',
          attempt: 1,
          request,
          response: { status: def.method === 'POST' ? 201 : 200, body: successBody(proc, pos) },
          error: null,
        },
      })
      continue
    }
    // Retryable failures (5xx) use all attempts; 409 is final at once.
    const attempt = o.status >= 500 ? def.max_retries + 1 : 1
    transitions.push({
      pos,
      step: {
        status: 'failed',
        attempt,
        request,
        response: { status: o.status, body: o.body },
        error: o.error,
      },
    })
    if (def.on_failure === 'continue') continue
    failedAt = pos
    failure = o
    for (let rest = pos + 1; rest <= proc.steps.length; rest++)
      transitions.push({ pos: rest, step: { status: 'skipped' } })
    break
  }
  const compensations: { pos: number; status: StepStatus }[] = []
  if (failedAt && proc.compensate_on_failure) {
    for (let pos = failedAt - 1; pos >= 1; pos--) {
      if (!proc.steps[pos - 1]!.has_compensation) continue
      // A dead console cannot undo its own work.
      compensations.push({
        pos,
        status:
          live && isDown(proc.steps[pos - 1]!.console.slug) ? 'compensation_failed' : 'compensated',
      })
    }
  }
  return { transitions, compensations, failedAt, failure }
}

function schedule(id: string, fn: () => void, ms: number) {
  const t = setTimeout(fn, ms / mockConfig.speed)
  timers.set(id, [...(timers.get(id) ?? []), t])
}

const stepDelay = () => (mockConfig.instantRuns ? 0 : 400 + Math.random() * 2100)

/** Play a run forward over time so 2-second polling sees it move step by step. */
function simulate(run: Run, proc: HubProcess, from: number) {
  const p = plan(proc, run.input, from)
  let at = mockConfig.instantRuns ? 0 : 600
  schedule(
    run.id,
    () => {
      run.status = 'running'
      run.started_at = new Date().toISOString()
    },
    at,
  )
  for (const t of p.transitions) {
    const d = stepDelay()
    const step = run.steps![t.pos - 1]!
    if (t.step.status !== 'skipped') {
      schedule(
        run.id,
        () => {
          step.status = 'running'
          step.attempt = 1
          step.request = t.step.request
        },
        at,
      )
      // Show visible retries: attempt counter climbs while running.
      const attempts = t.step.attempt ?? 1
      for (let a = 2; a <= attempts; a++) {
        schedule(
          run.id,
          () => {
            step.attempt = a
          },
          at + (d * (a - 1)) / attempts,
        )
      }
    }
    at += t.step.status === 'skipped' ? 0 : d
    const duration = Math.round(d)
    schedule(
      run.id,
      () => {
        Object.assign(step, t.step, t.step.status === 'skipped' ? {} : { duration_ms: duration })
      },
      at,
    )
  }
  for (const c of p.compensations) {
    at += stepDelay() / 2
    schedule(
      run.id,
      () => {
        run.steps![c.pos - 1]!.status = c.status
        if (c.status === 'compensation_failed')
          run.steps![c.pos - 1]!.error =
            `Kompensasi gagal: ${proc.steps[c.pos - 1]!.console.name} tidak dapat dihubungi. Batalkan secara manual di console.`
      },
      at,
    )
  }
  schedule(
    run.id,
    () => {
      run.status = p.failedAt ? 'failed' : 'succeeded'
      run.finished_at = new Date().toISOString()
      run.error_summary = p.failedAt && p.failure ? summary(proc, p.failedAt, p.failure) : null
      timers.delete(run.id)
    },
    at + 50,
  )
}

export function startRun(
  proc: HubProcess,
  input: Record<string, unknown>,
  by: { id: number; name: string },
  retryOf: Run | null = null,
): Run {
  const now = Date.now()
  const run: Run = {
    id: newId(now),
    process: { id: proc.id, name: proc.name },
    status: 'queued',
    input,
    triggered_by: by,
    created_at: new Date(now).toISOString(),
    started_at: null,
    finished_at: null,
    error_summary: null,
    retry_of: retryOf?.id ?? null,
    steps: blankSteps(proc),
  }
  // Same rule as the UI (lib/runs.ts): a compensated run restarts from step 1,
  // otherwise it resumes at the failed step and keeps earlier successes.
  let from = 1
  if (retryOf && retryMode(retryOf) === 'from_failed') {
    const failed = retryOf.steps!.find((s) => s.status === 'failed')
    from = failed?.position ?? 1
    for (const s of retryOf.steps!) if (s.position < from) run.steps![s.position - 1] = { ...s }
  }
  runs.unshift(run)
  simulate(run, proc, from)
  return run
}

export function cancelRun(run: Run) {
  for (const t of timers.get(run.id) ?? []) clearTimeout(t)
  timers.delete(run.id)
  run.status = 'canceled'
  run.finished_at = new Date().toISOString()
  for (const s of run.steps ?? []) {
    if (s.status === 'running') {
      s.status = 'failed'
      s.error = 'Dibatalkan oleh pengguna saat langkah berjalan'
    } else if (s.status === 'pending') s.status = 'skipped'
  }
}

// ---- History: 20 deterministic runs over the last 6 days ----

const r = seeded(4242)
const SCRIPT: { proc: number; kind: 'ok' | 'stock' | 'timeout' | 'canceled' | 'comp_failed' }[] = [
  { proc: 1, kind: 'ok' },
  { proc: 2, kind: 'ok' },
  { proc: 1, kind: 'stock' },
  { proc: 3, kind: 'ok' },
  { proc: 1, kind: 'ok' },
  { proc: 2, kind: 'timeout' },
  { proc: 1, kind: 'ok' },
  { proc: 3, kind: 'ok' },
  { proc: 1, kind: 'canceled' },
  { proc: 2, kind: 'ok' },
  { proc: 1, kind: 'timeout' },
  { proc: 1, kind: 'ok' },
  { proc: 2, kind: 'ok' },
  { proc: 3, kind: 'timeout' },
  { proc: 2, kind: 'comp_failed' },
  { proc: 1, kind: 'ok' },
  { proc: 2, kind: 'ok' },
  { proc: 3, kind: 'ok' },
  { proc: 1, kind: 'ok' },
  { proc: 1, kind: 'stock' },
]
const CUSTOMERS = [
  'Toko Roti Makmur',
  'CV Sumber Rezeki',
  'PT Pangan Nusantara',
  'Koperasi Karyawan Sejahtera',
  'UD Berkah Jaya',
]

function historicInput(procId: number, kind: string): Record<string, unknown> {
  if (procId === 1)
    return {
      customer: r.pick(CUSTOMERS),
      sku: `SKU-BJ-00${r.int(1, 6)}`,
      qty: kind === 'stock' ? r.int(120, 300) : r.int(10, 90),
    }
  if (procId === 2)
    return {
      name: r.pick(PEOPLE.slice(6)),
      division: r.pick(['Produksi', 'Gudang']),
      role: 'Operator',
    }
  return { nik: `E-${pad(r.int(1, 12))}`, reason: r.pick(['Mengundurkan diri', 'Kontrak selesai']) }
}

function seedHistory() {
  const now = Date.now()
  SCRIPT.forEach((s, i) => {
    const proc = findProcess(s.proc)!
    const created = now - (SCRIPT.length - i) * 6.5 * 3_600_000 - r.int(0, 3_000_000)
    const input = historicInput(s.proc, s.kind)
    const by = r.pick(users)
    const run: Run = {
      id: newId(created),
      process: { id: proc.id, name: proc.name },
      status: 'queued',
      input,
      triggered_by: { id: by.id, name: by.name },
      created_at: new Date(created).toISOString(),
      started_at: new Date(created + 400).toISOString(),
      finished_at: null,
      error_summary: null,
      retry_of: null,
      steps: blankSteps(proc),
    }
    let t = created + 400
    if (s.kind === 'canceled') {
      const first = run.steps![0]!
      Object.assign(first, {
        status: 'succeeded',
        attempt: 1,
        duration_ms: 820,
        request: {
          method: proc.steps[0]!.method,
          url: stepUrl(proc, 1, input),
          body: requestBody(proc, 1, input),
        },
        response: { status: 201, body: successBody(proc, 1) },
      })
      Object.assign(run.steps![1]!, {
        status: 'failed',
        attempt: 1,
        duration_ms: 3100,
        error: 'Dibatalkan oleh pengguna saat langkah berjalan',
      })
      run.steps![2]!.status = 'skipped'
      run.status = 'canceled'
      run.finished_at = new Date(t + 3920).toISOString()
      runs.unshift(run)
      return
    }
    const p = plan(
      proc,
      input,
      1,
      s.kind === 'stock'
        ? 'stock'
        : s.kind === 'timeout' || s.kind === 'comp_failed'
          ? 'timeout'
          : undefined,
      false,
    )
    for (const tr of p.transitions) {
      const d = tr.step.status === 'skipped' ? 0 : r.int(300, 2500) * (tr.step.attempt ?? 1)
      Object.assign(
        run.steps![tr.pos - 1]!,
        tr.step,
        tr.step.status === 'skipped' ? {} : { duration_ms: d },
      )
      t += d
    }
    for (const c of p.compensations) run.steps![c.pos - 1]!.status = c.status
    // One historic case where undoing step 1 failed too (HR timed out during compensation).
    if (s.kind === 'comp_failed') {
      Object.assign(run.steps![0]!, {
        status: 'compensation_failed',
        error:
          'Kompensasi gagal: Web HR tidak merespons dalam 10 detik (DELETE /v1/employees/E-021). Hapus karyawan secara manual di Web HR.',
      })
    }
    run.status = p.failedAt ? 'failed' : 'succeeded'
    run.finished_at = new Date(t + 200).toISOString()
    run.error_summary = p.failedAt && p.failure ? summary(proc, p.failedAt, p.failure) : null
    runs.unshift(run)
  })
}
seedHistory()

export const visibleRuns = (): Run[] => (getScenario() === 'empty' ? [] : runs)

export const findRun = (id: string) => runs.find((x) => x.id === id)
