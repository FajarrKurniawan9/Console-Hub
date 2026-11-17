import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { tokenStore } from '../lib/api'
import { server } from '../mocks/node'
import { mockConfig, setScenario } from '../mocks/scenarios'

mockConfig.instant = true
mockConfig.instantRuns = true

// jsdom lacks these browser APIs used by sonner and Radix.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  tokenStore.clear()
  sessionStorage.clear()
  setScenario('ok')
})
afterAll(() => server.close())
