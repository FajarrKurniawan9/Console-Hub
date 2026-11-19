import { authHandlers } from './auth'
import { gudangHandlers } from './gudang'

export const handlers = [...authHandlers, ...gudangHandlers]
