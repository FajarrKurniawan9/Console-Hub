import { render } from '@testing-library/react'
import { App } from '../app/App'
import { createQueryClient } from '../app/providers'
import { tokenStore } from '../lib/api/client'
import { signedIn, users } from './api'

/** Render the whole app at a path. `as` signs in with the fake hub's defaults for that role first. */
export function renderApp(path: string, as?: keyof typeof users) {
  if (as) {
    tokenStore.set(`test-token-${as}`)
    signedIn(as)
  }
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
  return render(<App client={client} initialPath={path} />)
}
