import { authHandlers } from './auth'
import { consoleHandlers } from './consoles'
import { logHandlers } from './logs'
import { overviewHandlers } from './overview'
import { processHandlers } from './processes'
import { resourceHandlers } from './resources'
import { runHandlers } from './runs'

export const handlers = [
  ...authHandlers,
  ...consoleHandlers,
  ...logHandlers,
  ...overviewHandlers,
  ...processHandlers,
  ...runHandlers,
  ...resourceHandlers,
]
