import clsx from 'clsx'
import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent/90',
  secondary: 'border bg-bg text-fg hover:bg-panel',
  ghost: 'text-muted hover:bg-panel hover:text-fg',
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
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 font-semibold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
