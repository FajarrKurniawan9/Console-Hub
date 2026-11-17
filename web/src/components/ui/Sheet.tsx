import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useRef, type ReactNode } from 'react'

/** Side panel for details and edits. Esc and the close button both close it. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  // Panels open from rows/buttons, not a Radix Trigger, so restore focus ourselves.
  const returnTo = useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            returnTo.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(e) => {
            if (returnTo.current?.isConnected) {
              e.preventDefault()
              returnTo.current.focus()
            }
          }}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-bg"
          aria-describedby={description ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Dialog.Title className="font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-xs text-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Panel detail</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Tutup panel"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface hover:text-fg"
            >
              <X size={16} strokeWidth={1.5} aria-hidden />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t px-4 py-3">{footer}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
