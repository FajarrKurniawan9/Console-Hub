import { useQuery } from '@tanstack/react-query'
import { request } from '../../lib/api/client'
import { itemDashboardSummary, one, type ItemDashboardSummary } from '../../lib/api/schemas'

export interface DashboardFilter {
  days?: number
  from?: string | null
  to?: string | null
}

export const dashboardKeys = {
  root: ['dashboard'] as const,
  items: (filter: DashboardFilter | number) => ['dashboard', 'items', filter] as const,
}

export function useItemDashboard(filter: DashboardFilter | number = 7) {
  const params =
    typeof filter === 'number'
      ? `days=${filter}`
      : filter.from && filter.to
        ? `from=${filter.from}&to=${filter.to}`
        : `days=${filter.days ?? 7}`

  return useQuery<ItemDashboardSummary>({
    queryKey: dashboardKeys.items(filter),
    queryFn: () =>
      request(one(itemDashboardSummary), {
        url: `/dashboard/items?${params}`,
      }).then((r) => r.data),
    staleTime: 30_000,
  })
}
