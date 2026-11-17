import type { HubProcess } from '../../lib/schemas'

/** Check form strings against `input_schema` (required, integer, min) and convert types. */
export function validateInput(schema: HubProcess['input_schema'], values: Record<string, string>) {
  const input: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  for (const [key, spec] of Object.entries(schema)) {
    const raw = (values[key] ?? '').trim()
    if (!raw) {
      if (spec.required) errors[key] = `${spec.label} wajib diisi.`
      continue
    }
    if (spec.type === 'integer') {
      if (!/^-?\d+$/.test(raw)) {
        errors[key] = `${spec.label} harus bilangan bulat.`
        continue
      }
      const n = Number(raw)
      if (spec.min !== undefined && n < spec.min) {
        errors[key] = `${spec.label} minimal ${spec.min}.`
        continue
      }
      input[key] = n
    } else input[key] = raw
  }
  return { input, errors }
}
