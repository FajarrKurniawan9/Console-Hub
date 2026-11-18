import type { User } from '../../lib/schemas'

// Mock credentials, documented in README. Dummy data only.
export const PASSWORD = 'konsol123'

export const users: User[] = [
  { id: 1, name: 'Rina Wulandari', email: 'rina@pabrik-sejahtera.id', is_admin: true },
  { id: 2, name: 'Budi Santoso', email: 'budi@pabrik-sejahtera.id', is_admin: false },
]
