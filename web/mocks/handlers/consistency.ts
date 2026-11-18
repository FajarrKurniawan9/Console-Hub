import { http } from 'msw'
import { recordAudit } from '../data/audit'
import {
  checks,
  findings,
  repair,
  startCheck,
  visibleChecks,
  type EntityType,
} from '../data/consistency'
import { fail, guard, latency, ok, page, url } from '../http'
import { mockConfig } from '../scenarios'

const TYPES: EntityType[] = ['divisi', 'karyawan', 'barang']
const runMs = () => (mockConfig.instantTx ? 0 : 2500 + Math.random() * 2000)

export const consistencyHandlers = [
  http.get(url('/admin/consistency/checks'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.consistency.view')
    if (g.error) return g.error
    const rows = [...visibleChecks()].sort((a, b) => b.started_at.localeCompare(a.started_at))
    return page(structuredClone(rows), null, rows.length)
  }),

  http.get(url('/admin/consistency/checks/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'admin.consistency.view')
    if (g.error) return g.error
    const check = visibleChecks().find((c) => c.id === Number(params.id))
    if (!check) return fail('NOT_FOUND', `Pemeriksaan #${params.id} tidak ada.`)
    return ok({
      data: {
        ...structuredClone(check),
        findings: structuredClone(findings.filter((f) => f.check_id === check.id)),
      },
    })
  }),

  http.post(url('/admin/consistency/checks'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.consistency.repair')
    if (g.error) return g.error
    const body = (await request.json().catch(() => ({}))) as { entity_type?: string }
    const type = body.entity_type as EntityType
    if (!TYPES.includes(type))
      return fail('VALIDATION_FAILED', 'Pilih entitas yang akan diperiksa.', {
        fields: { entity_type: ['Pilih Divisi, Karyawan, atau Barang.'] },
      })
    if (checks.some((c) => c.entity_type === type && c.status === 'running'))
      return fail('CONFLICT', `Pemeriksaan ${type} masih berjalan. Tunggu sampai selesai.`)
    const check = startCheck(type, runMs())
    recordAudit(
      g.user,
      'consistency.checked',
      { type: 'consistency_check', id: String(check.id) },
      null,
      {
        entity_type: type,
      },
    )
    return ok({ data: structuredClone(check) }, 202)
  }),

  http.post(url('/admin/consistency/findings/:id/repair'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'admin.consistency.repair')
    if (g.error) return g.error
    const f = findings.find((x) => x.id === Number(params.id))
    if (!f) return fail('NOT_FOUND', `Temuan #${params.id} tidak ada.`)
    if (f.repaired_at) return fail('CONFLICT', 'Temuan ini sudah diperbaiki.')
    repair(f, mockConfig.instantTx ? 0 : 800 + Math.random() * 1200)
    recordAudit(
      g.user,
      'consistency.repaired',
      { type: f.entity_type, id: f.entity_id },
      f.console.slug,
      {
        finding_id: f.id,
        kind: f.kind,
        changes: { version: { old: f.console_version, new: f.owner_version } },
      },
    )
    return ok({ data: structuredClone(f) }, 202)
  }),
]
