// MSW node server for Vitest. Removed at integration together with the rest of /mocks.
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetConsistency } from './data/consistency'
import { resetRbac } from './data/users'
import { resetWork } from './data/work'
import { resetTransactions } from './engine/transactions'
import { server } from './node'
import { mockConfig, setScenario } from './scenarios'

mockConfig.instant = true
mockConfig.instantTx = true

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  setScenario('ok')
  resetWork()
  resetTransactions()
  resetConsistency()
  resetRbac()
})
afterAll(() => server.close())
