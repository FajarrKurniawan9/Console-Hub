import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError } from '../../lib/api/client'
import { errorMessage } from '../../lib/errors'
import { useSession } from './useSession'

const schema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi.').pipe(z.email('Masukkan alamat email yang benar.')),
  password: z.string().min(1, 'Sandi wajib diisi.'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const { user, login } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [message, setMessage] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null)
    try {
      await login(values)
      navigate(from, { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHENTICATED') setMessage('Email atau sandi salah.')
      else {
        for (const [k, v] of Object.entries(e instanceof ApiError ? e.fields : {}))
          if (k === 'email' || k === 'password') form.setError(k, { message: v })
        setMessage(e instanceof ApiError && e.code === 'RATE_LIMITED' ? e.message : errorMessage(e))
      }
    }
  })

  const { errors, isSubmitting } = form.formState
  return (
    <main className="flex min-h-screen items-start justify-center bg-panel px-4 pt-[16vh]">
      <div className="w-full max-w-sm rounded-sm border bg-bg p-6">
        <p className="text-xs font-semibold text-muted">Console Gudang</p>
        <h1 className="mb-5 text-title font-semibold">Masuk</h1>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field
            label="Email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            error={errors.email?.message}
            {...form.register('email')}
          />
          <Field
            label="Sandi"
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...form.register('password')}
          />
          <div aria-live="polite">
            {message ? (
              <p role="alert" className="rounded-sm border border-error/30 bg-error/5 px-3 py-2 text-error">
                {message}
              </p>
            ) : null}
          </div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            {isSubmitting ? 'Memeriksa…' : 'Masuk'}
          </Button>
        </form>
      </div>
    </main>
  )
}
