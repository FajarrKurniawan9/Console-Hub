import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, CheckCircle2, CircleAlert, Mail, RefreshCw, Terminal } from 'lucide-react'
import { Recaptcha } from '../../components/Recaptcha'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError, toApiError, tokenStore } from '../../lib/api/client'
import { describeError } from '../../lib/errors'
import { useAuth } from './auth'
import { OtpInput } from './OtpInput'

export function LoginPage() {
  const { user, requestOtp, verifyOtp, expired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [resendTimer, setResendTimer] = useState(0)
  const [otpSentNotice, setOtpSentNotice] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => {
      setResendTimer((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  const urlParams = new URLSearchParams(location.search)
  const oauthErrorMsg = urlParams.get('error') ? decodeURIComponent(urlParams.get('error')!) : null
  const oauthReason = urlParams.get('reason')

  // Handle redirect from Google OAuth with token in URL query
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tokenParam = params.get('token')
    if (tokenParam) {
      tokenStore.set(tokenParam)
      navigate(from, { replace: true })
    }
  }, [location.search, from, navigate])

  // Redirect if already authenticated
  if (user) return <Navigate to={from} replace />

  const fieldError = (name: string) => {
    if (name === 'email' && error?.code === 'NOT_FOUND') {
      return 'Email ini belum terdaftar di sistem Console Hub.'
    }
    return error?.fields[name]?.[0]
  }

  function handleGoogleLogin() {
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1'
    const redirectUrl = apiBase.startsWith('http')
      ? `${apiBase}/auth/google/redirect`
      : `${window.location.origin}${apiBase}/auth/google/redirect`
    window.location.href = redirectUrl
  }

  // Step 1: Request OTP
  async function onRequestOtp(e?: FormEvent) {
    if (e) e.preventDefault()
    if (!email.trim()) return

    setPending(true)
    setError(null)
    setOtpSentNotice(null)

    try {
      const res = await requestOtp({
        email: email.trim(),
        recaptcha_token: recaptchaToken ?? undefined,
      })
      setStep('otp')
      setOtp('')
      setResendTimer(60)
      setOtpSentNotice(res.message || 'Kode verifikasi telah dikirim ke email Anda.')
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setPending(false)
    }
  }

  // Step 2: Verify OTP
  async function onVerifyOtp(customOtp?: string) {
    const code = (customOtp ?? otp).trim()
    if (code.length !== 6) return

    setPending(true)
    setError(null)

    try {
      await verifyOtp({
        email: email.trim(),
        otp: code,
      })
      navigate(from, { replace: true })
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setPending(false)
    }
  }

  const isUnregistered =
    error?.code === 'NOT_FOUND' ||
    oauthReason === 'account_not_registered' ||
    Boolean(oauthErrorMsg && oauthErrorMsg.toLowerCase().includes('belum terdaftar'))

  let formError: string | null = null
  if (oauthErrorMsg) {
    formError = oauthErrorMsg
  } else if (error?.code === 'UNAUTHENTICATED') {
    formError = 'Kode verifikasi salah atau sudah kedaluwarsa.'
  } else if (error?.code === 'FORBIDDEN') {
    formError = error.message
  } else if (error?.code === 'NOT_FOUND') {
    formError = 'Email tidak terdaftar di sistem. Hubungi Admin IT.'
  } else if (error && error.code !== 'VALIDATION_ERROR') {
    const d = describeError(error, false)
    formError = `${d.title}. ${d.next}`
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-4 bg-surface/40">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-bg p-6 sm:p-8 shadow-sm flex flex-col gap-6 transition-all">
        {/* Brand Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-on-accent shadow-xs">
              <Terminal size={18} strokeWidth={2.2} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-tight text-fg">Console Hub</span>
              <span className="text-[11px] text-muted">Portal Multi-Console</span>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-1">
            <h1 className="text-title font-bold text-fg">
              {step === 'email' ? 'Masuk' : 'Verifikasi OTP'}
            </h1>
            <p className="text-dense text-muted">
              {step === 'email'
                ? 'Masukkan email akun Anda untuk menerima kode verifikasi OTP.'
                : 'Masukkan 6 digit kode yang telah dikirim ke kotak masuk email Anda.'}
            </p>
          </div>
        </div>

        {/* Expired Session Alert */}
        {expired && !error ? (
          <div
            role="status"
            className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3.5 py-2.5 text-xs text-[var(--warn)]"
          >
            Sesi Anda sudah berakhir. Silakan masuk kembali untuk melanjutkan ke halaman terakhir.
          </div>
        ) : null}

        {/* Unregistered Email Alert */}
        {isUnregistered ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-error/30 bg-error/10 p-3.5 text-xs text-error"
          >
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <CircleAlert size={17} className="shrink-0 text-error" aria-hidden />
              <span>Email Belum Terdaftar</span>
            </div>
            <p className="text-fg leading-relaxed">
              Email yang Anda gunakan belum terdaftar di sistem <strong>Console Hub</strong>. Sesuai kebijakan keamanan portal, akun baru harus didaftarkan terlebih dahulu oleh Admin IT.
            </p>
            <div className="rounded-lg bg-bg/90 border border-error/20 p-2 text-[11px] text-muted">
              <span className="font-semibold text-fg">💡 Cara Mengatasi:</span> Hubungi Admin IT untuk mendaftarkan alamat email Anda.
            </div>
          </div>
        ) : formError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[var(--error)]/40 bg-[var(--error)]/10 px-3.5 py-2.5 text-xs text-[var(--error)]"
          >
            <CircleAlert size={15} className="shrink-0 mt-0.5 text-error" aria-hidden />
            <span>{formError}</span>
          </div>
        ) : null}

        {/* STEP 1: EMAIL & BOT PREVENTION */}
        {step === 'email' ? (
          <form onSubmit={onRequestOtp} noValidate className="flex flex-col gap-4">
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@perusahaan.com"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldError('email')}
            />

            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-xs font-semibold text-fg">Verifikasi Keamanan</span>
              <Recaptcha
                value={recaptchaToken}
                onChange={setRecaptchaToken}
                error={fieldError('recaptcha_token')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={pending || !email.trim()}
              className="mt-2 h-10 w-full rounded-lg font-medium"
            >
              {pending ? <Spinner /> : <Mail size={16} />}
              {pending ? 'Mengirim kode…' : 'Kirim kode verifikasi'}
            </Button>

            {/* Divider */}
            <div className="relative my-1 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <span className="relative bg-bg px-2 text-[11px] uppercase tracking-wider text-muted">
                atau
              </span>
            </div>

            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoogleLogin}
              className="h-10 w-full rounded-lg font-medium hover:bg-surface"
            >
              <GoogleIcon className="size-4 shrink-0" />
              Lanjutkan dengan Google
            </Button>
          </form>
        ) : (
          /* STEP 2: 6-DIGIT OTP VERIFICATION */
          <div className="flex flex-col gap-5">
            {/* Target Email Banner */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="size-2 rounded-full bg-[var(--ok)] shrink-0" />
                <span className="font-mono text-fg truncate">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setError(null)
                  setOtp('')
                }}
                className="text-xs font-semibold text-accent hover:underline shrink-0 ml-2"
              >
                Ganti email
              </button>
            </div>

            {/* OTP Sent Success Notice */}
            {otpSentNotice ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--ok)]/30 bg-[var(--ok)]/5 px-3 py-2 text-xs text-[var(--ok)]">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{otpSentNotice}</span>
              </div>
            ) : null}

            {/* 6 Digit Inputs */}
            <div className="flex flex-col gap-2">
              <label className="text-dense font-semibold text-fg">Kode OTP (6 Digit)</label>
              <OtpInput
                length={6}
                value={otp}
                onChange={(val) => {
                  setOtp(val)
                  if (error) setError(null)
                }}
                onComplete={(val) => void onVerifyOtp(val)}
                disabled={pending}
                error={Boolean(error)}
              />
              {fieldError('otp') ? (
                <p role="alert" className="text-xs text-error">
                  {fieldError('otp')}
                </p>
              ) : null}
            </div>

            {/* Verify Button */}
            <Button
              type="button"
              variant="primary"
              onClick={() => void onVerifyOtp()}
              disabled={pending || otp.length !== 6}
              className="h-10 w-full rounded-lg font-medium"
            >
              {pending ? <Spinner /> : null}
              {pending ? 'Memverifikasi…' : 'Verifikasi & Masuk'}
            </Button>

            {/* Resend & Back Actions */}
            <div className="flex items-center justify-between pt-1 text-xs text-muted">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setError(null)
                }}
                className="inline-flex items-center gap-1 hover:text-fg transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                Kembali
              </button>

              <button
                type="button"
                disabled={resendTimer > 0 || pending}
                onClick={() => void onRequestOtp()}
                className={`inline-flex items-center gap-1 font-medium transition-colors ${
                  resendTimer > 0
                    ? 'opacity-60 cursor-not-allowed'
                    : 'text-accent hover:underline cursor-pointer'
                }`}
              >
                <RefreshCw size={13} className={pending ? 'animate-spin' : ''} />
                {resendTimer > 0 ? `Kirim ulang (${resendTimer}s)` : 'Kirim ulang kode'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}
