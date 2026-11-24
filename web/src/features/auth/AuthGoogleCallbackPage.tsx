import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { LoaderCircle, Terminal } from 'lucide-react'
import { useAuth } from './auth'

export function AuthGoogleCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { exchangeGoogleCode } = useAuth()

  useEffect(() => {
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      const messages: Record<string, string> = {
        oauth_failed: 'Gagal terhubung dengan layanan Google OAuth.',
        account_not_registered: 'Email akun Google Anda belum terdaftar di sistem. Hubungi Admin IT.',
        account_inactive: 'Akun Anda dinonaktifkan. Hubungi Admin IT untuk mengaktifkannya.',
      }
      const msg = messages[error] ?? 'Terjadi kesalahan saat masuk dengan Google.'
      navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true })
      return
    }

    if (!code) {
      navigate('/login', { replace: true })
      return
    }

    let isMounted = true
    exchangeGoogleCode(code)
      .then(() => {
        if (isMounted) navigate('/', { replace: true })
      })
      .catch((err) => {
        if (isMounted) {
          const msg =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Kode otorisasi Google tidak valid atau kedaluwarsa.'
          navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true })
        }
      })

    return () => {
      isMounted = false
    }
  }, [params, exchangeGoogleCode, navigate])

  return (
    <main className="min-h-dvh flex items-center justify-center p-4 bg-surface/40">
      <div className="w-full max-w-[380px] rounded-2xl border border-border bg-bg p-8 shadow-sm flex flex-col items-center text-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-on-accent shadow-xs">
          <Terminal size={22} strokeWidth={2.2} />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-bold text-fg">Menyelesaikan Masuk</h1>
          <p className="text-xs text-muted">
            Sedang memverifikasi akun Google Anda dengan portal...
          </p>
        </div>
        <div className="pt-2">
          <LoaderCircle size={22} className="animate-spin text-accent" aria-hidden />
        </div>
      </div>
    </main>
  )
}
