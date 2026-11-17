import type { QueryClient } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, MemoryRouter } from 'react-router'
import { Providers } from './providers'
import { AppRoutes } from './routes'

const DevScenarioSwitch =
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_MOCKS === 'true' &&
  import.meta.env.MODE !== 'test'
    ? lazy(() => import('./DevScenarioSwitch'))
    : null

export function App({ client, initialPath }: { client?: QueryClient; initialPath?: string }) {
  const routes = <AppRoutes />
  return (
    <Providers client={client}>
      {initialPath ? (
        <MemoryRouter initialEntries={[initialPath]}>{routes}</MemoryRouter>
      ) : (
        <BrowserRouter>{routes}</BrowserRouter>
      )}
      {DevScenarioSwitch ? (
        <Suspense>
          <DevScenarioSwitch />
        </Suspense>
      ) : null}
    </Providers>
  )
}
