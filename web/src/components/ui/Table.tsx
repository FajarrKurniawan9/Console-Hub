import clsx from 'clsx'
import type { ComponentProps } from 'react'

/** Dense table primitives (13px, tabular numbers, border separators). */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx('w-full border-collapse text-dense', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={clsx(
        'h-8 border-b bg-surface px-3 text-left text-xs font-semibold whitespace-nowrap text-muted',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={clsx('h-9 border-b px-3 align-middle', className)} {...props} />
}

export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={clsx('transition-colors duration-150', className)} {...props} />
}
