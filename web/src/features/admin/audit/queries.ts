import { useInfiniteQuery } from '@tanstack/react-query'
import { params, request } from '../../../lib/api/client'
import { auditEvent, many } from '../../../lib/api/schemas'

export type AuditFilters = {
  user_id: string
  console_id: string
  action: string
  from: string | null
  to: string | null
}

export function useAudit(f: AuditFilters) {
  return useInfiniteQuery({
    queryKey: ['audit', f],
    queryFn: ({ pageParam }) =>
      request(many(auditEvent), {
        url: '/admin/audit',
        params: params({ ...f, limit: 50, cursor: pageParam }),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor,
  })
}
