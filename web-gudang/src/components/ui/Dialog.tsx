import { X } from 'lucide-react'
import { Dialog as D } from 'radix-ui'
import type { ReactNode } from 'react'
import { useReturnFocus } from './useReturnFocus'

function Header({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <D.Title className="font-semibold">{title}</D.Title>
        <D.Description className={description ? 'text-xs text-muted' : 'sr-only'}>
          {description ?? 'Panel detail'}
        </D.Description>
      </div>
      <D.Close
        aria-label="Tutup"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-panel hover:text-fg"
      >
        <X size={16} strokeWidth={1.5} aria-hidden />
      </D.Close>
    </div>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Centered dialog for forms. */
export function Modal({ open, onOpenChange, title, description, children, footer }: Props) {
  const focus = useReturnFocus()
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-fg/30" />
        <D.Content
          onCloseAutoFocus={focus.onCloseAutoFocus}
          className="fixed top-[10vh] left-1/2 z-50 flex max-h-[80vh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 flex-col rounded-sm border bg-bg shadow-pop"
        >
          <Header title={title} description={description} />
          <div className="overflow-y-auto p-4">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t px-4 py-3">{footer}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

/** Detail panel from the right, so the list stays in place. */
export function Drawer({ open, onOpenChange, title, description, children, footer }: Props) {
  const focus = useReturnFocus()
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-fg/20" />
        <D.Content
          onCloseAutoFocus={focus.onCloseAutoFocus}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-bg"
        >
          <Header title={title} description={description} />
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t px-4 py-3">{footer}</div> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
