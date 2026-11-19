import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, MemoryRouter } from 'react-router'
import { createQueryClient } from './queryClient'
import { AppRoutes } from './routes'

export function App({ client, initialPath }: { client?: QueryClient; initialPath?: string }) {
  const [queryClient] = useState(() => client ?? createQueryClient())
  const routes = <AppRoutes />
  return (
    <QueryClientProvider client={queryClient}>
      {initialPath ? (
        <MemoryRouter initialEntries={[initialPath]}>{routes}</MemoryRouter>
      ) : (
        <BrowserRouter basename={import.meta.env.BASE_URL}>{routes}</BrowserRouter>
      )}
    </QueryClientProvider>
  )
}
