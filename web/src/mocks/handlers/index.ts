import { authHandlers } from './auth'
import { consoleHandlers } from './consoles'
import { overviewHandlers } from './overview'

export const handlers = [...authHandlers, ...consoleHandlers, ...overviewHandlers]
