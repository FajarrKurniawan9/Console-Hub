import { http } from 'msw'
import { recordAudit } from '../data/audit'
import { findProcess, processes } from '../data/processes'
import { startRun } from '../data/runs'
import { fail, guard, latency, ok, page, url } from '../http'
import { getScenario } from '../scenarios'

export const processHandlers = [
  http.get(url('/processes'), async ({ request }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const list = getScenario() === 'empty' ? [] : processes
    return page(list, null, list.length)
  }),

  http.get(url('/processes/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const p = findProcess(Number(params.id))
    if (!p || getScenario() === 'empty') return fail('NOT_FOUND', `Proses #${params.id} tidak ada.`)
    return ok({ data: p })
  }),

  http.post(url('/processes/:id/runs'), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const p = findProcess(Number(params.id))
    if (!p) return fail('NOT_FOUND', `Proses #${params.id} tidak ada.`)
    if (!p.is_active) return fail('CONFLICT', `Proses "${p.name}" sedang nonaktif.`)

    const body = (await request.json().catch(() => ({}))) as { input?: Record<string, unknown> }
    const input = body.input ?? {}
    const fields: Record<string, string[]> = {}
    for (const [key, spec] of Object.entries(p.input_schema)) {
      const v = input[key]
      const empty = v === undefined || v === null || v === ''
      if (empty) {
        if (spec.required) fields[key] = [`${spec.label} wajib diisi.`]
        continue
      }
      if (spec.type === 'integer') {
        if (typeof v !== 'number' || !Number.isInteger(v))
          fields[key] = [`${spec.label} harus bilangan bulat.`]
        else if (spec.min !== undefined && v < spec.min)
          fields[key] = [`${spec.label} minimal ${spec.min}.`]
      } else if (typeof v !== 'string') fields[key] = [`${spec.label} harus teks.`]
    }
    if (getScenario() === 'validation-error') {
      const first = Object.keys(p.input_schema)[0]!
      fields[first] = [
        `Ditolak backend: nilai ${p.input_schema[first]!.label.toLowerCase()} tidak dikenal di console tujuan.`,
      ]
    }
    if (Object.keys(fields).length)
      return fail('VALIDATION_FAILED', 'Input proses tidak valid.', { fields })

    const run = startRun(p, input, { id: g.user.id, name: g.user.name })
    recordAudit(g.user, 'run.started', { type: 'run', id: run.id }, null, {
      process: p.name,
      input,
    })
    return ok({ data: { id: run.id, status: run.status } }, 202)
  }),
]
