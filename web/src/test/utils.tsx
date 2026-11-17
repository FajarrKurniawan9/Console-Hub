import { render } from '@testing-library/react'
import { App } from '../app/App'
import { createQueryClient } from '../app/providers'
import { tokenStore } from '../lib/api'

/** Render the whole app at a path. `as` logs in as a mock user first. */
export function renderApp(path: string, as?: 'admin' | 'operator') {
  if (as) tokenStore.set(`mock-${as === 'admin' ? 1 : 2}-test`)
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
  return render(<App client={client} initialPath={path} />)
}
