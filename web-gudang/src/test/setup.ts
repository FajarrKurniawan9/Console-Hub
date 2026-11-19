import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { tokenStore } from '../lib/api/client'

// jsdom tidak punya API ini; dipakai Radix.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
  tokenStore.clear()
  sessionStorage.clear()
})
