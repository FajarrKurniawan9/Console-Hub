import { CircleAlert, Info, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { describeError } from '../../lib/errors'
import { useIsAdminView } from '../../lib/permissions'
import type { WriteOutcome } from './useWrite'

/**
 * Inline result of a write, placed above the form's buttons. Conflicts open a dialog
 * with "Muat ulang". Admin IT also sees refusals per console and the transaction id.
 */
export function WriteFeedback({
  outcome,
  onReload,
  onDismiss,
}: {
  outcome: WriteOutcome
  onReload: () => void
  onDismiss: () => void
}) {
  const admin = useIsAdminView()

  if (outcome.kind === 'refused')
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-md border border-error px-3 py-2">
        <p className="flex items-start gap-2 text-dense">
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            className="mt-px shrink-0 text-error"
            aria-hidden
          />
          <span>
            <span className="font-semibold">Tidak dapat disimpan.</span> {outcome.message}{' '}
            <span className="text-muted">Tidak ada data yang berubah.</span>
          </span>
        </p>
        {admin && outcome.refusals.length ? (
          <details className="text-dense">
            <summary className="cursor-pointer text-muted">
              Alasan per console ({outcome.refusals.length})
              {outcome.txId ? <TxLink id={outcome.txId} /> : null}
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
              {outcome.refusals.map((r) => (
                <li key={r.console + r.code} className="flex flex-wrap gap-x-2">
                  <span className="font-semibold">{r.console}</span>
                  <span className="font-mono text-xs text-error">{r.code}</span>
                  <span className="text-muted">{r.message}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    )

  if (outcome.kind === 'error') {
    const d = describeError(outcome.error, admin)
    const showMessage = admin || (d.code !== 'NETWORK' && d.code !== 'CONTRACT_MISMATCH')
    return (
      <div
        role="alert"
        className="flex flex-col gap-1 rounded-md border border-error px-3 py-2 text-dense"
      >
        <p className="flex items-start gap-2">
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            className="mt-px shrink-0 text-error"
            aria-hidden
          />
          <span>
            <span className="font-semibold">{d.title}.</span> {d.next}
          </span>
        </p>
        {d.code === 'VALIDATION_FAILED' ? null : showMessage && d.message ? (
          <p className={admin ? 'font-mono text-xs text-muted' : 'text-muted'}>
            {admin ? `${d.code} · ` : ''}
            {d.message}
          </p>
        ) : null}
      </div>
    )
  }

  if (outcome.kind === 'conflict')
    return (
      <Modal
        open
        onOpenChange={(o) => !o && onDismiss()}
        title="Data sudah berubah"
        description="Perubahan Anda belum disimpan."
      >
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2">
            <Info size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            {outcome.message}
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={onDismiss}>Tutup</Button>
            <Button variant="primary" onClick={onReload}>
              <RefreshCw size={16} strokeWidth={1.5} aria-hidden />
              Muat ulang
            </Button>
          </div>
        </div>
      </Modal>
    )

  return null
}

function TxLink({ id }: { id: string }) {
  return (
    <>
      {' '}
      <Link
        to={`/transaksi/${id}`}
        className="font-mono text-xs text-accent underline-offset-4 hover:underline"
      >
        {id}
      </Link>
    </>
  )
}
