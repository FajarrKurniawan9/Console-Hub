// MSW node server for Vitest. Removed at integration together with the rest of /mocks.
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetWork } from './data/work'
import { transactions } from './engine/transactions'
import { server } from './node'
import { mockConfig, setScenario } from './scenarios'

mockConfig.instant = true
mockConfig.instantTx = true

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  setScenario('ok')
  resetWork()
  transactions.length = 0
})
afterAll(() => server.close())
