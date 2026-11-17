import clsx from 'clsx'

export function ConsoleChip({
  name,
  down,
  className,
}: {
  name: string
  down?: boolean
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-xs',
        down ? 'border-error text-error' : 'text-muted',
        className,
      )}
      title={down ? `${name} sedang mati` : undefined}
    >
      {name}
      {down ? <span className="sr-only">(mati)</span> : null}
    </span>
  )
}
