import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, CheckCircle2, Mail, RefreshCw, Terminal } from 'lucide-react'
import { Recaptcha } from '../../components/Recaptcha'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError, toApiError } from '../../lib/api/client'
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

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => {
      setResendTimer((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  // Redirect if already authenticated
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  const fieldError = (name: string) => error?.fields[name]?.[0]

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

  let formError: string | null = null
  if (error?.code === 'UNAUTHENTICATED') {
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

        {/* Global Error Alert */}
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-[var(--error)]/40 bg-[var(--error)]/10 px-3.5 py-2.5 text-xs text-[var(--error)]"
          >
            {formError}
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
