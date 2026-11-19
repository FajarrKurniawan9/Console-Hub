import type { ReactNode } from 'react'

/** Thin bar on top of each page: page title and the page's main actions. */
export function Topbar({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-bg px-6">
      <h1 className="truncate text-title font-semibold">{title}</h1>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-sm border bg-bg ${className}`}>{children}</div>
}

export function Section({
  title,
  aside,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** The small "read-only, managed elsewhere" note above shared-data tables. */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-sm border bg-panel px-3 py-2 text-muted">{children}</p>
}
