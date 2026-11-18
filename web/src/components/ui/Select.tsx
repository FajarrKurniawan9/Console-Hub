import clsx from 'clsx'
import type { ComponentProps } from 'react'

/** Native select: keyboard and screen-reader support for free. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={clsx('h-control rounded-md border bg-bg px-2 text-dense text-fg', className)}
      {...props}
    />
  )
}
