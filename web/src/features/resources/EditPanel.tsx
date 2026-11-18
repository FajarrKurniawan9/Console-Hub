import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Sheet } from '../../components/ui/Sheet'
import { Spinner } from '../../components/ui/Spinner'
import { toApiError } from '../../lib/api'
import { describeError } from '../../lib/errors'
import type { DataRecord } from '../../lib/schemas'
import { changeSummary, COLUMN_LABELS, columnOf, display, recordLabel, specFor } from './fields'
import { useUpdateRecord } from './queries'

interface Props {
  consoleId: number
  consoleName: string
  resourceKey: string
  writable: string[]
  record: DataRecord | null
  onClose: () => void
}

export function EditPanel(props: Props) {
  // Remount the form per record so its state starts from that record.
  return (
    <Sheet
      open={props.record !== null}
      onOpenChange={(o) => !o && props.onClose()}
      title={props.record ? `Ubah ${recordLabel(props.record)}` : 'Ubah data'}
      description={`${props.consoleName} · hanya field yang diizinkan console`}
    >
      {props.record ? (
        <EditForm key={String(props.record.id)} {...props} record={props.record} />
      ) : null}
    </Sheet>
  )
}

const asInput = (v: unknown) => (v === null || v === undefined ? '' : String(v))

function EditForm({
  consoleId,
  consoleName,
  resourceKey,
  writable,
  record,
  onClose,
}: Props & { record: DataRecord }) {
  const update = useUpdateRecord(consoleId, resourceKey)
  const [values, setValues] = useState(() =>
    Object.fromEntries(writable.map((f) => [f, asInput(record[f])])),
  )
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const serverError = update.error ? toApiError(update.error) : null
  const fieldError = (f: string) => clientErrors[f] ?? serverError?.fields[f]?.[0]

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errors: Record<string, string> = {}
    const changed: Record<string, unknown> = {}
    for (const f of writable) {
      if (values[f] === asInput(record[f])) continue
      const parsed = specFor(f).schema.safeParse(values[f])
      if (parsed.success) changed[f] = parsed.data
      else errors[f] = parsed.error.issues[0]?.message ?? 'Nilai tidak valid.'
    }
    setClientErrors(errors)
    if (Object.keys(errors).length) return
    if (!Object.keys(changed).length) {
      toast(`Tidak ada perubahan pada ${recordLabel(record)}.`)
      onClose()
      return
    }
    update.mutate(
      { id: record.id, fields: changed },
      {
        onSuccess: (updated) => {
          toast.success(changeSummary(record, updated, Object.keys(changed)))
          onClose()
        },
      },
    )
  }

  const generalError =
    serverError && serverError.code !== 'VALIDATION_FAILED'
      ? describeError(serverError, () => consoleName)
      : null

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {generalError ? (
        <p role="alert" className="rounded-md border border-error px-3 py-2 text-dense">
          <span className="font-semibold">{generalError.title}.</span> {generalError.next}
          <span className="mt-1 block font-mono text-xs text-muted">
            {generalError.code} · {generalError.message}
          </span>
        </p>
      ) : serverError ? (
        <p role="alert" className="rounded-md border border-error px-3 py-2 text-dense">
          {consoleName} menolak perubahan. Perbaiki field yang ditandai.
        </p>
      ) : null}

      {writable.map((f) => {
        const spec = specFor(f)
        const set = (v: string) => setValues((s) => ({ ...s, [f]: v }))
        if (spec.input === 'select') {
          const err = fieldError(f)
          return (
            <label key={f} className="flex flex-col gap-1">
              <span className="text-dense font-semibold">{spec.label}</span>
              <Select
                value={values[f]}
                onChange={(e) => set(e.target.value)}
                aria-invalid={err ? true : undefined}
                className="h-9 aria-[invalid=true]:border-error"
              >
                {spec.options!.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {err ? <span className="text-xs text-error">{err}</span> : null}
            </label>
          )
        }
        return (
          <Field
            key={f}
            label={spec.label}
            name={f}
            value={values[f]}
            onChange={(e) => set(e.target.value)}
            inputMode={spec.input === 'integer' ? 'numeric' : undefined}
            className={spec.input === 'integer' ? '[&_input]:font-mono' : undefined}
            error={fieldError(f)}
            hint={`Sekarang: ${display(f, record[columnOf(f)] ?? record[f])}${f === 'price_idr' ? ' · dalam rupiah, kelipatan 500' : ''}`}
          />
        )
      })}

      <ReadOnly record={record} writable={writable} />

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={onClose}>Batal</Button>
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? <Spinner /> : null}
          {update.isPending ? `Menyimpan ke ${consoleName}…` : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}

function ReadOnly({ record, writable }: { record: DataRecord; writable: string[] }) {
  const shown = new Set([...writable, ...writable.map(columnOf), 'id'])
  const rest = Object.keys(record).filter((k) => !shown.has(k))
  if (!rest.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">Tidak dapat diubah dari portal</span>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-dense">
        {rest.map((k) => (
          <div key={k} className="contents">
            <dt className="text-muted">{COLUMN_LABELS[k] ?? k}</dt>
            <dd className={/^(nik|sku)$/.test(k) ? 'font-mono' : ''}>{display(k, record[k])}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
