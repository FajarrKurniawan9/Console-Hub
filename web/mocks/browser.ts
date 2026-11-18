import { setupWorker } from 'msw/browser'
import { startLogTicker } from './data/logs'
import { mountDevPanel } from './DevPanel'
import { handlers } from './handlers'

export async function startMocks() {
  const worker = setupWorker(...handlers)
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true })
  startLogTicker()
  mountDevPanel()
}
