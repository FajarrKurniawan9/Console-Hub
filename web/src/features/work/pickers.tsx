import { SelectField } from '../../components/ui/Select'
import { useOptions } from './queries'

/** Person / production picker fed by `/people` or `/productions` (active only). */
export function RefPicker({
  kind,
  label,
  name,
  value,
  error,
  hint,
}: {
  kind: 'people' | 'productions'
  label: string
  name: string
  /** Current id, kept as an option even if the list could not load it. */
  value: { id: string; label: string } | null
  error?: string
  hint?: string
}) {
  const q = useOptions(kind)
  const options =
    q.data?.map((r) =>
      'role' in r
        ? { id: r.id, label: `${r.name} · ${r.role}` }
        : { id: r.id, label: `${r.area} · ${r.production_type}` },
    ) ?? []
  if (value && !options.some((o) => o.id === value.id)) options.unshift(value)
  const noun = kind === 'people' ? 'personel' : 'produksi'
  return (
    <SelectField
      label={label}
      name={name}
      defaultValue={value?.id ?? ''}
      error={error}
      hint={
        q.isError
          ? `Daftar ${noun} sedang tidak dapat dimuat. Isian ini boleh dikosongkan dulu.`
          : hint
      }
    >
      <option value="">{q.isPending ? `Memuat ${noun}…` : 'Belum ada'}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </SelectField>
  )
}
