import { Search } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { controlClass, Select } from './ui/Field'

/** Baris pencarian + filter di atas tabel. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2 border-b px-3 py-2">{children}</div>
}

export function SearchBox({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
}) {
  const id = useId()
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        size={14}
        strokeWidth={1.5}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className={`${controlClass} w-64 pl-8`}
      />
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<[value: string, label: string]>
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </div>
  )
}

export function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={controlClass} />
    </div>
  )
}
