import { auditHandlers } from './audit'
import { authHandlers } from './auth'
import { consoleHandlers } from './consoles'
import { logHandlers } from './logs'
import { overviewHandlers } from './overview'
import { rbacHandlers } from './rbac'
import { workHandlers } from './work'

export const handlers = [
  ...authHandlers,
  ...consoleHandlers,
  ...logHandlers,
  ...overviewHandlers,
  ...rbacHandlers,
  ...workHandlers,
  ...auditHandlers,
]
