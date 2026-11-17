import { Link } from 'react-router'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 pb-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-title font-semibold">{title}</h1>
        {meta ? <div className="text-xs text-muted">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
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

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-md border bg-bg ${className}`}>{children}</div>
}

/** Loading / error shell for detail pages: keeps the title and the way back visible. */
export function DetailShell({
  title,
  backTo,
  backLabel,
  children,
}: {
  title: string
  backTo: string
  backLabel: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={title}
        meta={
          <Link to={backTo} className="hover:text-fg">
            ← {backLabel}
          </Link>
        }
      />
      <Panel>{children}</Panel>
    </div>
  )
}
