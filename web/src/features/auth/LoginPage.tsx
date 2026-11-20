import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError, toApiError } from '../../lib/api/client'
import { describeError } from '../../lib/errors'
import { useAuth } from './auth'
import { Eye, EyeOff } from 'lucide-react'

export function LoginPage() {
  const { user, login, expired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  const fieldError = (name: string) => error?.fields[name]?.[0]

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    try {
      await login({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      navigate(from, { replace: true })
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setPending(false)
    }
  }

  let formError: string | null = null
  if (error?.code === 'UNAUTHENTICATED') formError = 'Email atau sandi salah.'
  else if (error?.code === 'FORBIDDEN') formError = error.message
  else if (error && error.code !== 'VALIDATION_ERROR') {
    const d = describeError(error, false)
    formError = `${d.title}. ${d.next}`
  }

  return (
    <main className="min-h-dvh px-4 py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-90 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Console Hub</span>
          <h1 className="text-title font-semibold">Masuk</h1>
        </div>

        {expired && !error ? (
          <p role="status" className="rounded-md border border-warn px-3 py-2 text-dense">
            Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan; Anda akan kembali ke halaman
            terakhir.
          </p>
        ) : null}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError ? (
            <p role="alert" className="rounded-md border border-error px-3 py-2 text-dense">
              {formError}
            </p>
          ) : null}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            error={fieldError('email')}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-dense font-semibold">
              Sandi <span className="text-muted">(wajib)</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                aria-invalid={fieldError('password') ? true : undefined}
                aria-describedby={fieldError('password') ? 'password-error' : undefined}
                className={`${inputClass} w-full pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                className="absolute right-2.5 text-muted hover:text-fg focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldError('password') ? (
              <p id="password-error" className="text-xs text-error">
                {fieldError('password')}
              </p>
            ) : null}
          </div>
          
          <Button type="submit" variant="primary" disabled={pending} className="h-9">
            {pending ? <Spinner /> : null}
            {pending ? 'Memeriksa…' : 'Masuk'}
          </Button>
        </form>
      </div>
    </main>
  )
}
