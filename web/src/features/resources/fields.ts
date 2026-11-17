import { z } from 'zod'

/**
 * How each known field is shown and validated on the client. The console still
 * validates (422) — these rules only catch obvious mistakes before sending.
 * Unknown fields fall back to a required text input.
 */
export interface FieldSpec {
  label: string
  input: 'text' | 'integer' | 'select'
  options?: { value: string; label: string }[]
  schema: z.ZodType
  /** Column the field is shown in, when it differs (division_id → division). */
  column?: string
  format?: (v: unknown) => string
}

const rupiah = (v: unknown) =>
  typeof v === 'number' ? `Rp${v.toLocaleString('id-ID')}` : String(v ?? '—')

export const DIVISION_OPTIONS = [
  { value: '1', label: 'Produksi' },
  { value: '2', label: 'Gudang' },
  { value: '3', label: 'HR' },
  { value: '4', label: 'Keuangan' },
  { value: '5', label: 'Logistik' },
]

const text = (label: string) => ({
  label,
  input: 'text' as const,
  schema: z.string().trim().min(1, 'Wajib diisi.').max(120, 'Maksimal 120 karakter.'),
})

export const FIELD_SPECS: Record<string, FieldSpec> = {
  name: text('Nama'),
  role: text('Jabatan'),
  status: {
    label: 'Status',
    input: 'select',
    options: [
      { value: 'aktif', label: 'aktif' },
      { value: 'nonaktif', label: 'nonaktif' },
    ],
    schema: z.enum(['aktif', 'nonaktif'], { message: 'Pilih aktif atau nonaktif.' }),
  },
  division_id: {
    label: 'Divisi',
    input: 'select',
    options: DIVISION_OPTIONS,
    column: 'division',
    schema: z.coerce.number().int(),
  },
  unit: text('Satuan'),
  min_stock: {
    label: 'Stok minimum',
    input: 'integer',
    schema: z.coerce
      .number({ message: 'Harus angka.' })
      .int('Harus bilangan bulat.')
      .min(0, 'Tidak boleh negatif.'),
  },
  price_idr: {
    label: 'Harga',
    input: 'integer',
    format: rupiah,
    schema: z.coerce
      .number({ message: 'Harus angka.' })
      .int('Harus bilangan bulat.')
      .min(1000, 'Minimal Rp1.000.')
      .refine((n) => n % 500 === 0, 'Harus kelipatan Rp500.'),
  },
}

export const COLUMN_LABELS: Record<string, string> = {
  nik: 'NIK',
  sku: 'SKU',
  name: 'Nama',
  division: 'Divisi',
  role: 'Jabatan',
  status: 'Status',
  type: 'Jenis',
  unit: 'Satuan',
  min_stock: 'Stok min.',
  price_idr: 'Harga',
  updated_at: 'Diubah',
}

export const specFor = (field: string): FieldSpec => FIELD_SPECS[field] ?? text(field)

/** The column a writable field appears in (division_id is shown as division). */
export const columnOf = (field: string) => FIELD_SPECS[field]?.column ?? field

/** Human id for a record: nik/sku if present, else #id. */
export const recordLabel = (r: Record<string, unknown>) =>
  String(r.sku ?? r.nik ?? `#${String(r.id)}`)

export function display(field: string, value: unknown): string {
  const f = FIELD_SPECS[field]?.format
  if (f) return f(value)
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return value.toLocaleString('id-ID')
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value))
    return new Date(value).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  return String(value)
}

/** "Harga SKU-BJ-002 diubah dari Rp125.000 menjadi Rp135.000" (old and new values). */
export function changeSummary(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
) {
  const id = recordLabel(after)
  const show = (r: Record<string, unknown>, f: string) => display(f, r[columnOf(f)] ?? r[f])
  if (fields.length === 1) {
    const f = fields[0]!
    return `${specFor(f).label} ${id} diubah dari ${show(before, f)} menjadi ${show(after, f)}`
  }
  return `${id} diubah: ${fields.map((f) => `${specFor(f).label} dari ${show(before, f)} menjadi ${show(after, f)}`).join('; ')}`
}
