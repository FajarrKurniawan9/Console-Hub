import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '../components/ui/Tooltip'
import { AuthProvider } from '../features/auth/auth'
import { ApiError } from '../lib/api/client'
import { ThemeProvider, useTheme } from '../lib/theme'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Retry once on network/5xx and on 429 (it is temporary); never on other 4xx.
        retry: (count, err) =>
          count < 1 &&
          !(
            err instanceof ApiError &&
            err.status >= 400 &&
            err.status < 500 &&
            err.code !== 'RATE_LIMITED'
          ),
        retryDelay: (_, err) =>
          err instanceof ApiError && err.code === 'RATE_LIMITED' ? 3000 : 1000,
      },
    },
  })
}

function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        className: '!rounded-md !border !border-border !bg-bg !text-fg !text-dense !shadow-pop',
      }}
    />
  )
}

export function Providers({ client, children }: { client?: QueryClient; children: ReactNode }) {
  const [queryClient] = useState(() => client ?? createQueryClient())
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <AuthProvider>{children}</AuthProvider>
          <ThemedToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
