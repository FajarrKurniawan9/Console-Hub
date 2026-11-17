import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { z } from 'zod'
import { request, setUnauthenticatedHandler, tokenStore } from '../../lib/api'
import { loginResult, one, user as userSchema, type User } from '../../lib/schemas'

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (input: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)
const ME = ['auth', 'me'] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [token, setToken] = useState(tokenStore.get)

  const me = useQuery({
    queryKey: ME,
    queryFn: () => request(one(userSchema), { url: '/auth/me' }).then((r) => r.data),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  })

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setToken(null)
      qc.clear()
    })
  }, [qc])

  const value: AuthState = {
    user: token ? (me.data ?? null) : null,
    isLoading: token !== null && me.isPending,
    login: async (input) => {
      const { data } = await request(one(loginResult), {
        url: '/auth/login',
        method: 'POST',
        data: input,
      })
      tokenStore.set(data.token)
      qc.setQueryData(ME, data.user)
      setToken(data.token)
    },
    logout: async () => {
      try {
        await request(z.unknown(), { url: '/auth/logout', method: 'POST' })
      } catch {
        // Logging out locally is enough when the server call fails.
      } finally {
        tokenStore.clear()
        setToken(null)
        qc.clear()
      }
    },
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
