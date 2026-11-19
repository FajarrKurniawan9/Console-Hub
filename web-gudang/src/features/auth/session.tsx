import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, request, setUnauthenticatedHandler, tokenStore } from '../../lib/api/client'
import { dataOf, loginResult, uiUser } from '../../lib/api/schemas'
import { z } from 'zod'
import { SessionContext, type Session } from './useSession'


export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [token, setToken] = useState(tokenStore.get)

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setToken(null)
      qc.clear()
    })
  }, [qc])

  const me = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: ({ signal }) => request(dataOf(uiUser), '/auth/me', { signal }).then((r) => r.data),
    enabled: !!token,
    retry: (n, e) => n < 1 && !(e instanceof ApiError && e.status < 500 && e.status > 0),
    staleTime: Infinity,
  })

  const value: Session = {
    user: token ? (me.data ?? null) : null,
    isLoading: !!token && me.isPending,
    // 401 sudah mengeluarkan sesi; selain itu tampilkan galat, jangan keluarkan staf.
    meError: me.error instanceof ApiError && me.error.status === 401 ? null : me.error,
    retryMe: () => void me.refetch(),
    async login(body) {
      const { data } = await request(dataOf(loginResult), '/auth/login', { method: 'POST', body })
      tokenStore.set(data.token)
      qc.setQueryData(['auth', 'me', data.token], data.user)
      setToken(data.token)
    },
    async logout() {
      try {
        await request(z.null(), '/auth/logout', { method: 'POST' })
      } catch {
        // Token tetap dibuang di sisi ini meski server gagal.
      }
      tokenStore.clear()
      setToken(null)
      qc.clear()
    },
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
