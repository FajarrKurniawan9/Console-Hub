import { render } from '@testing-library/react'
import { App } from '../app/App'
import { createQueryClient } from '../app/providers'
import { tokenStore } from '../lib/api/client'

const MOCK_USER_ID = { admin: 1, user: 2, 'user-no-create': 3 } as const

/** Render the whole app at a path. `as` logs in as a mock user first. */
export function renderApp(path: string, as?: keyof typeof MOCK_USER_ID) {
  if (as) tokenStore.set(`mock-${MOCK_USER_ID[as]}-test`)
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
  return render(<App client={client} initialPath={path} />)
}
