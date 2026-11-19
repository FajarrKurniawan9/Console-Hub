import { createContext, useContext } from 'react'
import type { LoginBody, UiUser } from '../../lib/api/types'

export type Session = {
  user: UiUser | null
  isLoading: boolean
  meError: unknown
  retryMe: () => void
  login: (body: LoginBody) => Promise<void>
  logout: () => Promise<void>
}

export const SessionContext = createContext<Session | null>(null)

export function useSession() {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession di luar SessionProvider')
  return s
}
