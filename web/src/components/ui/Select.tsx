import clsx from 'clsx'
import { useId, type ComponentProps } from 'react'

/** Native select: keyboard and screen-reader support for free. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={clsx('h-control rounded-md border bg-bg px-2 text-dense text-fg', className)}
      {...props}
    />
  )
}

/** Labelled select with the same error/hint layout as `Field`. */
export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...props
}: ComponentProps<'select'> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-dense font-semibold">
        {label}
        {props.required ? <span className="text-muted"> (wajib)</span> : null}
      </label>
      <Select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="aria-[invalid=true]:border-error"
        {...props}
      >
        {children}
      </Select>
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
