// Live contract check against a running hub (src/**/*.hub.test.ts). Node env, no mocks, no jsdom.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Expose HUB_* from the shell to import.meta.env in the test.
  envPrefix: ['HUB_'],
  test: { environment: 'node', include: ['src/**/*.hub.test.ts'] },
})
