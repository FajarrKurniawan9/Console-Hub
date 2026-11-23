import { useQuery } from '@tanstack/react-query'
import { request } from '../../lib/api/client'
import { itemDashboardSummary, one, type ItemDashboardSummary } from '../../lib/api/schemas'

export const dashboardKeys = {
  root: ['dashboard'] as const,
  items: (days: number) => ['dashboard', 'items', days] as const,
}

export function useItemDashboard(days = 7) {
  return useQuery<ItemDashboardSummary>({
    queryKey: dashboardKeys.items(days),
    queryFn: () =>
      request(one(itemDashboardSummary), {
        url: `/dashboard/items?days=${days}`,
      }).then((r) => r.data),
    staleTime: 30_000,
  })
}
