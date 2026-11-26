import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { z } from 'zod'
import {
  request,
  setForbiddenHandler,
  setUnauthenticatedHandler,
  tokenStore,
} from '../../lib/api/client'
import { authUser, loginResult, one, requestOtpResult, type AuthUser, type RequestOtpResult } from '../../lib/api/schemas'

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  /** `me` failed for a reason other than 401 (network, 5xx); the session may still be valid. */
  meError: unknown
  retryMe: () => void
  /** The last session ended on a 401 (expired or revoked), not by logging out. */
  expired: boolean
  login: (input: { email: string; password?: string }) => Promise<void>
  requestOtp: (input: { email: string; recaptcha_token?: string; resend_token?: string }) => Promise<RequestOtpResult>
  verifyOtp: (input: { email: string; otp: string }) => Promise<void>
  registerRequestOtp: (input: {
    name: string
    email: string
    recaptcha_token?: string
    resend_token?: string
  }) => Promise<RequestOtpResult>
  registerVerify: (input: {
    name: string
    email: string
    otp: string
    signup_token?: string
  }) => Promise<void>
  exchangeGoogleCode: (code: string) => Promise<void>
  updateProfile: (input: { name: string }) => Promise<AuthUser>
  logout: () => Promise<void>
  /** Reload `me` (e.g. after the role's permissions changed) so menus follow. */
  reloadMe: () => Promise<unknown>
}

const AuthContext = createContext<AuthState | null>(null)
export const ME = ['auth', 'me'] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [token, setToken] = useState(tokenStore.get)
  const [expired, setExpired] = useState(false)

  const me = useQuery({
    queryKey: ME,
    queryFn: () => request(one(authUser), { url: '/auth/me' }).then((r) => r.data),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
  })

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setExpired(true)
      setToken(null)
      qc.clear()
    })
    setForbiddenHandler(() => void qc.invalidateQueries({ queryKey: ME }))
  }, [qc])

  function applySession(data: { token: string; user: AuthUser }) {
    tokenStore.set(data.token)
    qc.setQueryData(ME, data.user)
    setExpired(false)
    setToken(data.token)
  }

  const value: AuthState = {
    user: token ? (me.data ?? null) : null,
    isLoading: token !== null && me.isPending,
    meError: token !== null && !me.data ? me.error : null,
    retryMe: () => void me.refetch(),
    expired,
    login: async (input) => {
      const { data } = await request(one(loginResult), {
        url: '/auth/login',
        method: 'POST',
        data: input,
      })
      applySession(data)
    },
    requestOtp: async (input) => {
      const { data } = await request(one(requestOtpResult), {
        url: '/auth/request-otp',
        method: 'POST',
        data: input,
      })
      return data
    },
    verifyOtp: async (input) => {
      const { data } = await request(one(loginResult), {
        url: '/auth/verify-otp',
        method: 'POST',
        data: input,
      })
      applySession(data)
    },
    registerRequestOtp: async (input) => {
      const { data } = await request(one(requestOtpResult), {
        url: '/auth/register/request-otp',
        method: 'POST',
        data: input,
      })
      return data
    },
    registerVerify: async (input) => {
      const { data } = await request(one(loginResult), {
        url: '/auth/register/verify',
        method: 'POST',
        data: input,
      })
      applySession(data)
    },
    exchangeGoogleCode: async (code: string) => {
      const { data } = await request(one(loginResult), {
        url: '/auth/google/exchange',
        method: 'POST',
        data: { code },
      })
      applySession(data)
    },
    updateProfile: async (input) => {
      const { data } = await request(one(authUser), {
        url: '/auth/profile',
        method: 'PATCH',
        data: input,
      })
      qc.setQueryData(ME, data)
      return data
    },
    reloadMe: () => qc.invalidateQueries({ queryKey: ME }),
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
