import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { Popover } from 'radix-ui'

export interface Option {
  value: string
  label: string
}

/** Checkbox list in a popover. Empty selection means "all". */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Option[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const summary =
    value.length === 0
      ? 'Semua'
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} dipilih`
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <Popover.Root>
      <Popover.Trigger
        className={clsx(
          'inline-flex h-8 items-center gap-1.5 rounded-md border bg-bg px-2.5 text-dense hover:bg-surface',
          value.length > 0 && 'border-accent',
        )}
      >
        <span className="text-muted">{label}:</span>
        <span>{summary}</span>
        <ChevronDown size={14} strokeWidth={1.5} className="text-muted" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-48 rounded-md border bg-bg p-1 text-dense shadow-pop"
        >
          <div role="group" aria-label={label} className="flex flex-col">
            {options.map((o) => {
              const checked = value.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  onClick={() => toggle(o.value)}
                  className="flex h-8 items-center gap-2 rounded-sm px-2 text-left hover:bg-surface"
                >
                  <span
                    aria-hidden
                    className={clsx(
                      'grid size-4 place-items-center rounded-[4px] border',
                      checked && 'border-accent bg-accent text-on-accent',
                    )}
                  >
                    {checked ? <Check size={12} strokeWidth={2} /> : null}
                  </span>
                  {o.label}
                </button>
              )
            })}
          </div>
          {value.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 h-7 w-full rounded-sm border-t px-2 text-left text-xs text-muted hover:text-fg"
            >
              Pilih semua
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
