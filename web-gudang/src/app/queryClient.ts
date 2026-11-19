import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../lib/api/client'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Ulang sekali untuk jaringan/5xx; tidak untuk 4xx (tidak akan berubah).
        retry: (n, e) => n < 1 && !(e instanceof ApiError && e.status >= 400 && e.status < 500),
      },
    },
  })
}
