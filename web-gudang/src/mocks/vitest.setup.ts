// Server MSW untuk Vitest. Dihapus saat integrasi bersama seluruh src/mocks.
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetState } from './engine/state'
import { server } from './node'
import { mockConfig, setScenario } from './scenarios'

mockConfig.instant = true

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  setScenario('ok')
  resetState()
})
afterAll(() => server.close())
