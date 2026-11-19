import clsx from 'clsx'
import { useId, type ComponentProps, type ReactNode } from 'react'

export const controlClass =
  'h-8 rounded-sm border bg-bg px-2.5 text-sm text-fg placeholder:text-muted aria-[invalid=true]:border-error'

/** Label + control + error/hint, connected by id and aria-describedby. */
function FieldShell({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: (a: { id: string; describedBy?: string }) => ReactNode
}) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="font-semibold">
        {label}
        {required ? null : <span className="font-normal text-muted"> (opsional)</span>}
      </label>
      {children({ id, describedBy })}
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

type Common = { label: string; error?: string; hint?: ReactNode; required?: boolean }

export function Field({
  label,
  error,
  hint,
  required,
  className,
  ...props
}: ComponentProps<'input'> & Common) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy }) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={controlClass}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function TextareaField({
  label,
  error,
  hint,
  required,
  className,
  ...props
}: ComponentProps<'textarea'> & Common) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          rows={2}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={clsx(controlClass, 'h-auto py-1.5')}
          {...props}
        />
      )}
    </FieldShell>
  )
}

/** Native select: keyboard and screen-reader support for free. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={clsx(controlClass, 'px-2', className)} {...props} />
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  children,
  ...props
}: ComponentProps<'select'> & Common) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy }) => (
        <Select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          {...props}
        >
          {children}
        </Select>
      )}
    </FieldShell>
  )
}
