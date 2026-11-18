import clsx from 'clsx'
import { useId, type ComponentProps } from 'react'

export const inputClass =
  'h-control rounded-md border bg-bg px-2.5 text-dense text-fg placeholder:text-muted aria-[invalid=true]:border-error'

export function Field({
  label,
  error,
  hint,
  className,
  ...props
}: ComponentProps<'input'> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-dense font-semibold">
        {label}
        {props.required ? <span className="text-muted"> (wajib)</span> : null}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
