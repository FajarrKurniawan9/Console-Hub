import type { HubConsole } from '../../lib/schemas'

export const AUTH_LABEL: Record<HubConsole['auth_type'], string> = {
  api_key: 'API key',
  bearer: 'Bearer token',
  basic: 'Basic auth',
}
