// MSW node server for Vitest. Removed at integration together with the rest of /mocks.
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetRbac } from './data/users'
import { server } from './node'
import { mockConfig, setScenario } from './scenarios'

mockConfig.instant = true

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  setScenario('ok')
  resetRbac()
})
afterAll(() => server.close())
