import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { toApiError } from '../../lib/api'
import { describeError } from '../../lib/errors'
import type { HubProcess } from '../../lib/schemas'
import { useStartRun } from './queries'
import { validateInput } from './validateInput'

/** Form built from `input_schema`; on success, go straight to the run page. */
export function RunDialog({
  process,
  open,
  onOpenChange,
}: {
  process: HubProcess
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Jalankan: ${process.name}`}
      description={`${process.steps.length} langkah akan dijalankan berurutan. Anda akan diarahkan ke halaman eksekusi.`}
    >
      {open ? <RunForm process={process} onCancel={() => onOpenChange(false)} /> : null}
    </Modal>
  )
}

function RunForm({ process, onCancel }: { process: HubProcess; onCancel: () => void }) {
  const navigate = useNavigate()
  const start = useStartRun(process.id)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.keys(process.input_schema).map((k) => [k, ''])),
  )
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const serverError = start.error ? toApiError(start.error) : null
  const fieldError = (k: string) => clientErrors[k] ?? serverError?.fields[k]?.[0]

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const { input, errors } = validateInput(process.input_schema, values)
    setClientErrors(errors)
    if (Object.keys(errors).length) return
    start.mutate(input, { onSuccess: (run) => navigate(`/runs/${run.id}`) })
  }

  const general =
    serverError && serverError.code !== 'VALIDATION_FAILED' ? describeError(serverError) : null

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {general ? (
        <p role="alert" className="rounded-md border border-error px-3 py-2 text-dense">
          <span className="font-semibold">{general.title}.</span> {general.next}
        </p>
      ) : serverError ? (
        <p role="alert" className="rounded-md border border-error px-3 py-2 text-dense">
          Input ditolak. Perbaiki field yang ditandai.
        </p>
      ) : null}
      {Object.entries(process.input_schema).map(([key, spec], i) => (
        <Field
          key={key}
          label={spec.label}
          name={key}
          required={spec.required}
          autoFocus={i === 0}
          inputMode={spec.type === 'integer' ? 'numeric' : undefined}
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          error={fieldError(key)}
          hint={
            spec.type === 'integer' && spec.min !== undefined
              ? `Bilangan bulat, minimal ${spec.min}.`
              : undefined
          }
        />
      ))}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={onCancel}>Batal</Button>
        <Button type="submit" variant="primary" disabled={start.isPending}>
          {start.isPending ? <Spinner /> : null}
          {start.isPending ? 'Mengirim…' : 'Jalankan'}
        </Button>
      </div>
    </form>
  )
}
