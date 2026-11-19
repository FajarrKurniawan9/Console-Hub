import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError, toApiError } from '../../lib/api/client'
import { usedBy, type UsedBy } from '../../lib/api/schemas'
import { sendWrite, type Resource, type WriteCall } from '../../lib/api/work'
import { useIsAdminView } from '../../lib/permissions'

/** What the screen shows after a write. Exactly one of these at a time. */
export type WriteOutcome =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'conflict' }
  | { kind: 'referenced'; message: string; usedBy: UsedBy }
  | { kind: 'error'; error: ApiError }

export interface WriteOptions {
  /** Toast text on success, e.g. "Barang disimpan". */
  success: string
  /** Query keys to refresh after the write. */
  invalidate: readonly (readonly unknown[])[]
  onDone?: () => void
}

/**
 * Shared save behaviour (update 2 §3.2): 200/201 → toast, refresh, close;
 * VERSION_CONFLICT → reload dialog; REFERENCED → plain sentence (Admin: what still uses it);
 * everything else inline. Nothing is marked as done before a success response.
 */
export function useWrite(resource: Resource) {
  const qc = useQueryClient()
  const admin = useIsAdminView()
  const [outcome, setOutcome] = useState<WriteOutcome>({ kind: 'idle' })

  async function run(call: WriteCall, o: WriteOptions) {
    setOutcome({ kind: 'saving' })
    try {
      await sendWrite(resource, call)
      await Promise.all(o.invalidate.map((queryKey) => qc.invalidateQueries({ queryKey })))
      setOutcome({ kind: 'idle' })
      toast.success(o.success)
      o.onDone?.()
      return true
    } catch (err) {
      const e = toApiError(err)
      if (e.code === 'VERSION_CONFLICT') setOutcome({ kind: 'conflict' })
      else if (e.code === 'REFERENCED') {
        const parsed = usedBy.safeParse(e.details?.used_by)
        setOutcome({
          kind: 'referenced',
          message: e.message,
          usedBy: admin && parsed.success ? parsed.data : [],
        })
      } else setOutcome({ kind: 'error', error: e })
      return false
    }
  }

  return {
    outcome,
    run,
    busy: outcome.kind === 'saving',
    reset: () => setOutcome({ kind: 'idle' }),
  }
}
