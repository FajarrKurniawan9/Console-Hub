import { render } from '@testing-library/react'
import { App } from '../app/App'
import { createQueryClient } from '../app/queryClient'
import { tokenStore } from '../lib/api/client'

/** Render seluruh app pada path. `loggedIn` memasang token sesi lebih dulu. */
export function renderApp(path: string, { loggedIn = true } = {}) {
  if (loggedIn) tokenStore.set('mock-1-test')
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
  return { client, ...render(<App client={client} initialPath={path} />) }
}
