import type { ReactNode } from 'react'

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-8">
      <p className="text-muted">{message}</p>
      {action}
    </div>
  )
}
