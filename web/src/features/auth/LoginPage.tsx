import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError, toApiError } from '../../lib/api/client'
import { describeError } from '../../lib/errors'
import { useAuth } from './auth'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

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
  else if (error && error.code !== 'VALIDATION_FAILED') {
    const d = describeError(error, false)
    formError = `${d.title}. ${d.next}`
  }

  return (
    <main className="min-h-dvh px-4 py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-[360px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Console Hub</span>
          <h1 className="text-title font-semibold">Masuk</h1>
        </div>

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
          <Field
            label="Sandi"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            error={fieldError('password')}
          />
          <Button type="submit" variant="primary" disabled={pending} className="h-9">
            {pending ? <Spinner /> : null}
            {pending ? 'Memeriksa…' : 'Masuk'}
          </Button>
        </form>
      </div>
    </main>
  )
}
