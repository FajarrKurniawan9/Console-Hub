import type { ReactNode } from 'react'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { Spinner } from './ui/Spinner'

/** Asks before an action with consequences. The body says what will happen. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busyLabel = 'Memproses…',
  danger,
  busy,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  busyLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      description={description}
    >
      <div className="flex flex-col gap-4">
        {children}
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : null}
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
