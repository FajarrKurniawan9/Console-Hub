import type { FormEvent, ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { Spinner } from '../../components/ui/Spinner'
import type { useWrite } from './useWrite'
import { WriteFeedback } from './WriteFeedback'

/** Side panel holding a create/edit form. Locked while saving; never closes on its own before success. */
export function FormSheet({
  open,
  onClose,
  title,
  description,
  submitLabel,
  write,
  onSubmit,
  onReload,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  submitLabel: string
  write: ReturnType<typeof useWrite>
  onSubmit: (form: FormData) => void
  onReload: () => void
  children: ReactNode
}) {
  const formId = `form-${title.replace(/\W+/g, '-').toLowerCase()}`
  const label =
    write.outcome.kind === 'saving'
      ? 'Menyimpan…'
      : write.outcome.kind === 'finishing'
        ? 'Sedang diselesaikan…'
        : submitLabel
  const close = () => {
    if (write.busy) return
    write.reset()
    onClose()
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={close} disabled={write.busy}>
            Batal
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={write.busy}>
            {write.busy ? <Spinner /> : null}
            {label}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault()
          if (!write.busy) onSubmit(new FormData(e.currentTarget))
        }}
        className="flex flex-col gap-4"
      >
        <fieldset disabled={write.busy} className="flex flex-col gap-4">
          {children}
        </fieldset>
        <WriteFeedback outcome={write.outcome} onReload={onReload} onDismiss={write.reset} />
      </form>
    </Sheet>
  )
}
