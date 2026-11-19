import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query'
import { ApiError } from '../../lib/api/client'
import type { Page, Source } from '../../lib/api/schemas'
import { SOURCE_CODES } from '../../lib/errors'

/** Sources that did not answer, from `meta.unavailable` or from a failed read of the owner. */
export function unavailableOf(
  query: UseInfiniteQueryResult<InfiniteData<Page<unknown>>>,
  owner: Source,
): Source[] {
  const e = query.error
  if (e instanceof ApiError && SOURCE_CODES.includes(e.code)) return [owner]
  return [...new Set(query.data?.pages.flatMap((p) => p.meta.unavailable ?? []) ?? [])]
}
