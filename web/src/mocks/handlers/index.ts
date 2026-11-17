import { authHandlers } from './auth'
import { consoleHandlers } from './consoles'
import { logHandlers } from './logs'
import { overviewHandlers } from './overview'
import { runHandlers } from './runs'

export const handlers = [
  ...authHandlers,
  ...consoleHandlers,
  ...logHandlers,
  ...overviewHandlers,
  ...runHandlers,
]
