import { useCan } from '../../lib/permissions'
import { ConsoleTrailAdmin } from './ConsoleTrailAdmin'
import { ConsoleTrailUser } from './ConsoleTrailUser'
import type { TrailInput } from './useTransactionTrail'

/**
 * "Jejak 3 console" after a write. The variant follows the permission, not the shell:
 * with `admin.transactions.view` the per-console rows, otherwise one plain sentence.
 */
export function ConsoleTrail({ trail, onClose }: { trail: TrailInput; onClose?: () => void }) {
  const can = useCan()
  if (can('admin.transactions.view') && trail.txId)
    return <ConsoleTrailAdmin txId={trail.txId} version={trail.version} onClose={onClose} />
  return <ConsoleTrailUser txId={trail.txId} failure={trail.failure} onClose={onClose} />
}
