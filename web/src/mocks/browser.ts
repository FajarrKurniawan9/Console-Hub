import { setupWorker } from 'msw/browser'
import { startLogTicker } from './data/logs'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)
startLogTicker()
