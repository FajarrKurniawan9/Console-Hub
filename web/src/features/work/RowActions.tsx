import { Pencil, Power } from 'lucide-react'
import { Button } from '../../components/ui/Button'

/** Ubah / Nonaktifkan buttons on a row; each one shown only with its permission. */
export function RowActions({
  name,
  canEdit,
  canDeactivate,
  inactive,
  onEdit,
  onDeactivate,
}: {
  name: string
  canEdit: boolean
  canDeactivate: boolean
  inactive: boolean
  onEdit: () => void
  onDeactivate: () => void
}) {
  if (inactive || (!canEdit && !canDeactivate)) return null
  return (
    <div className="flex justify-end gap-1">
      {canEdit ? (
        <Button variant="ghost" onClick={onEdit} aria-label={`Ubah ${name}`}>
          <Pencil size={16} strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">Ubah</span>
        </Button>
      ) : null}
      {canDeactivate ? (
        <Button variant="ghost" onClick={onDeactivate} aria-label={`Nonaktifkan ${name}`}>
          <Power size={16} strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">Nonaktifkan</span>
        </Button>
      ) : null}
    </div>
  )
}
