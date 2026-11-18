import clsx from 'clsx'
import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  secondary: 'border bg-bg text-fg hover:bg-surface',
  ghost: 'text-muted hover:bg-surface hover:text-fg',
  danger: 'border border-error bg-bg text-error hover:bg-surface',
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex h-control shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 text-dense font-semibold whitespace-nowrap transition-[color,background-color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
