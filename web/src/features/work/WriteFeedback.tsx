import { CircleAlert, Info, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { describeError } from '../../lib/errors'
import { useIsAdminView } from '../../lib/permissions'
import { SOURCE_LABEL, TYPE_LABEL } from './labels'
import type { WriteOutcome } from './useWrite'

/**
 * Inline result of a write, placed above the form's buttons. Conflicts open a dialog with
 * "Muat ulang". Admin IT also sees codes and what still uses a record.
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

  if (outcome.kind === 'referenced')
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-md border border-error px-3 py-2">
        <p className="flex items-start gap-2 text-dense">
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            className="mt-px shrink-0 text-error"
            aria-hidden
          />
          <span>Data ini masih dipakai oleh data lain, jadi belum bisa dinonaktifkan.</span>
        </p>
        {admin && outcome.usedBy.length ? (
          <div className="text-dense">
            <p className="text-muted">Dipakai oleh ({outcome.usedBy.length}):</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {outcome.usedBy.map((u) => (
                <li key={`${u.source}-${u.id}`} className="flex flex-wrap gap-x-2">
                  <span className="font-semibold">{u.name}</span>
                  <span className="text-muted">
                    {TYPE_LABEL[u.type] ?? u.type} · {SOURCE_LABEL[u.source]}
                  </span>
                  <span className="font-mono text-xs text-muted">{u.id}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    )

  if (outcome.kind === 'error') {
    const d = describeError(outcome.error, admin)
    // Field errors are shown under their fields; this line only says what to do.
    const fieldOnly = d.code === 'VALIDATION_ERROR' || d.code === 'REFERENCE_NOT_FOUND'
    const showMessage = admin || (!fieldOnly && d.code !== 'NETWORK' && d.code !== 'CONTRACT_MISMATCH')
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
        {showMessage && d.message ? (
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
            Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.
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
