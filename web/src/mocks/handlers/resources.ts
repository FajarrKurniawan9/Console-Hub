import { http } from 'msw'
import { consoleById, DOWN_ERROR, isDown } from '../data/consoles'
import { DIVISIONS, RESOURCES, type DataRow } from '../data/resources'
import { fail, guard, latency, ok, page, url } from '../http'
import { getScenario } from '../scenarios'

const UNITS = ['kg', 'liter', 'pcs', 'roll', 'karton', 'sak']

/** Per-field rules as each console would enforce them. Returns an error message or null. */
function check(field: string, value: unknown): string | null {
  const isInt = typeof value === 'number' && Number.isInteger(value)
  switch (field) {
    case 'name':
    case 'role':
      return typeof value === 'string' && value.trim() && value.length <= 120
        ? null
        : 'Wajib diisi, maksimal 120 karakter.'
    case 'status':
      return value === 'aktif' || value === 'nonaktif' ? null : 'Harus "aktif" atau "nonaktif".'
    case 'division_id':
      return DIVISIONS.some((d) => d.id === value)
        ? null
        : `ID divisi tidak dikenal. Pilihan: ${DIVISIONS.map((d) => `${d.id} (${d.name})`).join(', ')}.`
    case 'unit':
      return typeof value === 'string' && UNITS.includes(value)
        ? null
        : `Satuan harus salah satu dari: ${UNITS.join(', ')}.`
    case 'min_stock':
      return isInt && value >= 0 ? null : 'Harus bilangan bulat 0 atau lebih.'
    case 'price_idr':
      return isInt && value >= 1000 && value % 500 === 0
        ? null
        : 'Harga minimal Rp1.000 dan kelipatan Rp500.'
    default:
      return 'Field ini tidak boleh diubah.'
  }
}

function lookup(params: Record<string, string | readonly string[] | undefined>) {
  const seed = consoleById(Number(params.id))
  if (!seed) return { error: fail('NOT_FOUND', `Console #${params.id} tidak ada.`) }
  const res = RESOURCES[String(params.key)]
  if (!res || res.console !== seed.slug)
    return { error: fail('NOT_FOUND', `Sumber data "${params.key}" tidak ada di ${seed.name}.`) }
  if (isDown(seed.slug))
    return {
      error: fail(
        'CONSOLE_UNREACHABLE',
        `${seed.name} tidak dapat dihubungi: ${DOWN_ERROR(seed)}`,
        {
          console: seed.slug,
        },
      ),
    }
  const writable = seed.resources.find((r) => r.key === params.key)!.writable_fields
  return { seed, res, writable }
}

export const resourceHandlers = [
  http.get(url('/consoles/:id/resources/:key'), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const l = lookup(params)
    if (l.error) return l.error
    const q = new URL(request.url).searchParams
    const perPage = Math.min(Number(q.get('per_page') ?? 10), 100)
    const pageNo = Math.max(Number(q.get('page') ?? 1), 1)
    const text = q.get('q')?.toLowerCase()
    const rows = l.res.rows.filter(
      (row) => !text || Object.values(row).some((v) => String(v).toLowerCase().includes(text)),
    )
    const slice = rows.slice((pageNo - 1) * perPage, pageNo * perPage)
    const more = pageNo * perPage < rows.length
    return page(slice, more ? String(pageNo + 1) : null, rows.length)
  }),

  http.patch(url('/consoles/:id/resources/:key/:recordId'), async ({ request, params }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    const l = lookup(params)
    if (l.error) return l.error
    const row = l.res.rows.find((r) => r.id === Number(params.recordId))
    if (!row) return fail('NOT_FOUND', `Data #${params.recordId} tidak ada di ${l.seed.name}.`)

    const body = (await request.json().catch(() => ({}))) as { fields?: Record<string, unknown> }
    const input = body.fields ?? {}
    const fields: Record<string, string[]> = {}
    if (getScenario() === 'validation-error') {
      for (const k of Object.keys(input))
        fields[k] = [`Ditolak oleh ${l.seed.name}: nilai tidak lolos validasi console.`]
    } else {
      for (const [k, v] of Object.entries(input)) {
        const msg = l.writable.includes(k) ? check(k, v) : 'Field ini tidak boleh diubah.'
        if (msg) fields[k] = [msg]
      }
    }
    if (!Object.keys(input).length) fields.fields = ['Tidak ada field yang dikirim.']
    if (Object.keys(fields).length)
      return fail('VALIDATION_FAILED', 'Sebagian field tidak valid.', { fields })

    Object.assign(row, input)
    if ('division_id' in input)
      row.division = DIVISIONS.find((d) => d.id === input.division_id)!.name
    if ('updated_at' in row) row.updated_at = new Date().toISOString()
    return ok({ data: row satisfies DataRow })
  }),
]
