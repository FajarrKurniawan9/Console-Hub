import type { QueryClient } from '@tanstack/react-query'
import { BrowserRouter, MemoryRouter } from 'react-router'
import { Providers } from './providers'
import { AppRoutes } from './routes'

export function App({ client, initialPath }: { client?: QueryClient; initialPath?: string }) {
  const routes = <AppRoutes />
  return (
    <Providers client={client}>
      {initialPath ? (
        <MemoryRouter initialEntries={[initialPath]}>{routes}</MemoryRouter>
      ) : (
        <BrowserRouter>{routes}</BrowserRouter>
      )}
    </Providers>
  )
}
