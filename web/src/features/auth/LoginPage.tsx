import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, CheckCircle2, CircleAlert, Mail, RefreshCw, UserPlus } from 'lucide-react'
import { Recaptcha } from '../../components/Recaptcha'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError, toApiError, tokenStore } from '../../lib/api/client'
import { describeError } from '../../lib/errors'
import { AuthCard, GoogleIcon } from './AuthCard'
import { redirectToGoogleAuth } from './google'
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
  const [resendToken, setResendToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState<string | null>(null)

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
  const rawOauthError = urlParams.get('error')
  const oauthErrorMsg = rawOauthError ? decodeURIComponent(rawOauthError) : null
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
    if (name === 'recaptcha_token' && captchaError) {
      return captchaError
    }
    if (name === 'email' && error?.code === 'NOT_FOUND') {
      return 'Email ini belum terdaftar di sistem Console Hub.'
    }
    return error?.fields[name]?.[0]
  }

  async function submitRequestOtp(useResendToken: boolean) {
    if (!email.trim()) return

    if (!useResendToken && !recaptchaToken) {
      setCaptchaError('Verifikasi reCAPTCHA wajib diselesaikan.')
      return
    }
    setCaptchaError(null)

    setPending(true)
    setError(null)
    setOtpSentNotice(null)

    try {
      const res = await requestOtp({
        email: email.trim(),
        ...(useResendToken && resendToken
          ? { resend_token: resendToken }
          : { recaptcha_token: recaptchaToken ?? undefined }),
      })
      if (res.resend_token) {
        setResendToken(res.resend_token)
      }
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

  // Step 1: Request OTP
  function onRequestOtp(e?: FormEvent) {
    if (e) e.preventDefault()
    void submitRequestOtp(false)
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
    rawOauthError === 'account_not_registered' ||
    Boolean(
      oauthErrorMsg &&
        (oauthErrorMsg.toLowerCase().includes('belum terdaftar') ||
          oauthErrorMsg.toLowerCase().includes('tidak terdaftar') ||
          oauthErrorMsg.toLowerCase().includes('account_not_registered')),
    )

  const registerHref = email.trim()
    ? `/register?email=${encodeURIComponent(email.trim())}`
    : '/register'

  let formError: string | null = null
  if (oauthErrorMsg) {
    if (rawOauthError === 'account_not_registered') {
      formError = 'Email akun Google Anda belum terdaftar di sistem. Silakan daftar terlebih dahulu.'
    } else if (rawOauthError === 'account_inactive') {
      formError = 'Akun Anda dinonaktifkan. Hubungi Admin IT untuk mengaktifkannya.'
    } else if (rawOauthError === 'oauth_failed') {
      formError = 'Gagal terhubung dengan layanan Google OAuth.'
    } else {
      formError = oauthErrorMsg
    }
  } else if (error?.code === 'UNAUTHENTICATED') {
    formError = 'Kode verifikasi salah atau sudah kedaluwarsa.'
  } else if (error?.code === 'FORBIDDEN') {
    formError = error.message
  } else if (error?.code === 'NOT_FOUND') {
    formError = 'Email belum terdaftar di sistem. Silakan daftar terlebih dahulu.'
  } else if (error && error.code !== 'VALIDATION_ERROR') {
    const d = describeError(error, false)
    formError = `${d.title}. ${d.next}`
  }

  return (
    <AuthCard
      title={step === 'email' ? 'Masuk' : 'Verifikasi OTP'}
      subtitle={
        step === 'email'
          ? 'Masukkan email akun Anda untuk menerima kode verifikasi OTP.'
          : 'Masukkan 6 digit kode yang telah dikirim ke kotak masuk email Anda.'
      }
    >
      {/* Expired Session Alert */}
      {expired && !error ? (
        <div
          role="status"
          className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3.5 py-2.5 text-xs text-[var(--warn)]"
        >
          Sesi Anda sudah berakhir. Silakan masuk kembali untuk melanjutkan ke halaman terakhir.
        </div>
      ) : null}

      {/* Unregistered Email Alert -> Invite User to Sign Up */}
      {isUnregistered ? (
        <div
          role="alert"
          className="flex flex-col gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3.5 text-xs text-error"
        >
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <CircleAlert size={17} className="shrink-0 text-error" aria-hidden />
            <span>Email Belum Terdaftar</span>
          </div>
          <p className="text-fg leading-relaxed">
            Email yang Anda gunakan belum terdaftar di sistem <strong>Console Hub</strong>.
            Silakan buat akun baru terlebih dahulu untuk mendapatkan akses portal dengan peran User.
          </p>
          <Link
            to={registerHref}
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent hover:opacity-90 transition-opacity"
          >
            <UserPlus size={14} aria-hidden />
            Daftar Sekarang
          </Link>
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
              onChange={(token) => {
                setRecaptchaToken(token)
                if (token) setCaptchaError(null)
              }}
              error={fieldError('recaptcha_token')}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={pending || !email.trim() || !recaptchaToken}
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
            onClick={redirectToGoogleAuth}
            className="h-10 w-full rounded-lg font-medium hover:bg-surface"
          >
            <GoogleIcon className="size-4 shrink-0" />
            Lanjutkan dengan Google
          </Button>

          <p className="pt-1 text-center text-xs text-muted">
            Belum punya akun?{' '}
            <Link to={registerHref} className="font-semibold text-accent hover:underline">
              Daftar sekarang
            </Link>
          </p>
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
              className="text-xs font-semibold text-accent hover:underline shrink-0 ml-2 cursor-pointer"
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
              onClick={() => void submitRequestOtp(Boolean(resendToken))}
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
    </AuthCard>
  )
}
