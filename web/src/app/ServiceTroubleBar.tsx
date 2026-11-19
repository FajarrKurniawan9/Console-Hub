import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { ApiError } from '../lib/api/client'
import { SOURCE_CODES } from '../lib/errors'

/**
 * User shell: one plain line when any loaded data failed because a source is down.
 * Users cannot see source status, so this is derived from failed queries in the cache.
 */
export function ServiceTroubleBar() {
  const qc = useQueryClient()
  const cache = qc.getQueryCache()
  const trouble = useSyncExternalStore(
    (cb) => cache.subscribe(cb),
    () =>
      cache
        .getAll()
        .some(
          (q) => q.state.error instanceof ApiError && SOURCE_CODES.includes(q.state.error.code),
        ),
  )
  if (!trouble) return null
  return (
    <p
      role="status"
      className="mx-auto flex w-full max-w-4xl items-center gap-2 border-b border-warn px-4 py-2 text-dense"
    >
      <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-warn" aria-hidden />
      Sebagian layanan sedang bermasalah. Data yang bisa dibuka tetap tampil; perubahan data mungkin
      belum bisa disimpan. Coba lagi beberapa menit lagi.
    </p>
  )
}
