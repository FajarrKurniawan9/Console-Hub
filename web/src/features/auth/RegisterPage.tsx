import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, CheckCircle2, CircleAlert, Info, Mail, RefreshCw } from 'lucide-react'
import { Recaptcha } from '../../components/Recaptcha'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError, toApiError } from '../../lib/api/client'
import { describeError } from '../../lib/errors'
import { AuthCard, GoogleIcon } from './AuthCard'
import { redirectToGoogleAuth } from './google'
import { useAuth } from './auth'
import { OtpInput } from './OtpInput'

export function RegisterPage() {
  const { user, registerRequestOtp, registerVerify } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const urlParams = new URLSearchParams(location.search)
  const initialEmail = urlParams.get('email') ?? ''
  const initialName = urlParams.get('name') ?? ''
  const isFromGoogle = urlParams.get('from') === 'google'
  const signupToken = urlParams.get('signup_token') ?? ''

  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const [resendToken, setResendToken] = useState<string | null>(null)

  const [nameError, setNameError] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [resendTimer, setResendTimer] = useState(0)
  const [otpSentNotice, setOtpSentNotice] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => {
      setResendTimer((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  if (user) return <Navigate to={from} replace />

  const fieldError = (field: string) => {
    if (field === 'name' && nameError) return nameError
    if (field === 'recaptcha_token' && captchaError) return captchaError
    return error?.fields[field]?.[0]
  }

  async function submitRequestOtp(useResendToken: boolean) {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (trimmedName.length < 3) {
      setNameError('Nama lengkap minimal 3 huruf.')
      return
    }
    setNameError(null)

    if (!trimmedEmail) return

    if (!useResendToken && !recaptchaToken) {
      setCaptchaError('Verifikasi reCAPTCHA wajib diselesaikan.')
      return
    }
    setCaptchaError(null)

    setPending(true)
    setError(null)
    setOtpSentNotice(null)

    try {
      const res = await registerRequestOtp({
        name: trimmedName,
        email: trimmedEmail,
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
      setOtpSentNotice(res.message || 'Kode verifikasi pendaftaran telah dikirim ke email Anda.')
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setPending(false)
    }
  }

  function onSubmitForm(e: FormEvent) {
    e.preventDefault()
    void submitRequestOtp(false)
  }

  async function onVerifyOtp(customOtp?: string) {
    const code = (customOtp ?? otp).trim()
    if (code.length !== 6) return

    setPending(true)
    setError(null)

    try {
      await registerVerify({
        name: name.trim(),
        email: email.trim(),
        otp: code,
        ...(signupToken ? { signup_token: signupToken } : {}),
      })
      navigate(from, { replace: true })
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setPending(false)
    }
  }

  let formError: string | null = null
  if (error && error.code !== 'VALIDATION_ERROR') {
    const d = describeError(error, false)
    formError = `${d.title}. ${d.next}`
  }

  return (
    <AuthCard
      title={step === 'form' ? 'Daftar Akun' : 'Verifikasi Email'}
      subtitle={
        step === 'form'
          ? 'Buat akun Console Hub baru. Akun otomatis aktif dengan peran User.'
          : 'Masukkan 6 digit kode verifikasi yang telah dikirim ke kotak masuk email Anda.'
      }
    >
      {/* Redirected from unregistered Google OAuth */}
      {step === 'form' && isFromGoogle && !error ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-2.5 text-xs text-fg"
        >
          <Info size={16} className="shrink-0 mt-0.5 text-accent" aria-hidden />
          <span>
            Akun Google Anda belum terdaftar. Lengkapi data dan verifikasi email di bawah ini untuk
            langsung masuk ke <strong>Console Hub</strong>.
          </span>
        </div>
      ) : null}

      {/* Global Error Alert */}
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[var(--error)]/40 bg-[var(--error)]/10 px-3.5 py-2.5 text-xs text-[var(--error)]"
        >
          <CircleAlert size={15} className="shrink-0 mt-0.5 text-error" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      {/* STEP 1: NAME, EMAIL & RECAPTCHA */}
      {step === 'form' ? (
        <form onSubmit={onSubmitForm} noValidate className="flex flex-col gap-4">
          <Field
            label="Nama lengkap"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Nama lengkap Anda"
            required
            autoFocus={!initialName}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError(null)
              if (error) setError(null)
            }}
            error={fieldError('name')}
          />

          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@perusahaan.com"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
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
            disabled={pending || !name.trim() || !email.trim() || !recaptchaToken}
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
            Daftar dengan Google
          </Button>

          <p className="pt-1 text-center text-xs text-muted">
            Sudah punya akun?{' '}
            <Link to="/login" className="font-semibold text-accent hover:underline">
              Masuk di sini
            </Link>
          </p>
        </form>
      ) : (
        /* STEP 2: 6-DIGIT EMAIL VERIFICATION -> AUTO LOGIN */
        <div className="flex flex-col gap-5">
          {/* Target Registration Info Banner */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="size-2 rounded-full bg-[var(--ok)] shrink-0" />
              <div className="flex flex-col truncate">
                <span className="font-semibold text-fg truncate">{name}</span>
                <span className="font-mono text-[11px] text-muted truncate">{email}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('form')
                setError(null)
                setOtp('')
              }}
              className="text-xs font-semibold text-accent hover:underline shrink-0 ml-2 cursor-pointer"
            >
              Ubah data
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
            <label className="text-dense font-semibold text-fg">Kode Verifikasi (6 Digit)</label>
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

          {/* Verify & Enter Console Hub Button */}
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
                setStep('form')
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
