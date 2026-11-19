import clsx from 'clsx'
import type { ComponentProps, KeyboardEvent } from 'react'

/** Dense table: 36px rows, sticky header, numbers right-aligned in mono via `num`. */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="max-h-[calc(100vh-220px)] overflow-auto">
      <table className={clsx('w-full border-collapse', className)} {...props} />
    </div>
  )
}

export function Th({ className, num, ...props }: ComponentProps<'th'> & { num?: boolean }) {
  return (
    <th
      scope="col"
      className={clsx(
        'sticky top-0 z-[1] h-8 border-b bg-panel px-3 text-xs font-semibold whitespace-nowrap text-muted',
        num ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, num, ...props }: ComponentProps<'td'> & { num?: boolean }) {
  return (
    <td
      className={clsx(
        'h-9 border-b px-3 align-middle',
        num && 'text-right font-mono text-[13px] whitespace-nowrap',
        className,
      )}
      {...props}
    />
  )
}

/** A row that opens something: clickable, focusable, Enter/Space activates. */
export function Tr({
  className,
  onActivate,
  ...props
}: ComponentProps<'tr'> & { onActivate?: () => void }) {
  if (!onActivate) return <tr className={className} {...props} />
  return (
    <tr
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className={clsx('cursor-pointer hover:bg-panel focus-visible:bg-panel', className)}
      {...props}
    />
  )
}
