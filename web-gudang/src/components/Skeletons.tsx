import clsx from 'clsx'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('animate-pulse rounded-sm bg-border', className)} />
}

export function RowsSkeleton({ rows = 6, label = 'Memuat data' }: { rows?: number; label?: string }) {
  return (
    <div className="flex flex-col divide-y" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-9 items-center gap-4 px-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}
