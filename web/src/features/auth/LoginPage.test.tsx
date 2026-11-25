import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { calls, fail, ok, on, signedIn, users } from '../../test/api'
import { renderApp } from '../../test/utils'

async function submitEmail(email: string) {
  renderApp('/login')
  await userEvent.type(await screen.findByLabelText(/Email/), email)
  const captcha = screen.queryByRole('button', { name: /Verifikasi Saya bukan robot/ })
  if (captcha) {
    await userEvent.click(captcha)
  }
  await userEvent.click(screen.getByRole('button', { name: /Kirim kode/ }))
}

async function login(email: string, otp = '123456') {
  on('POST /auth/request-otp', ok({ message: 'Kode verifikasi telah dikirim.' }))
  await submitEmail(email)
  const firstDigit = await screen.findByLabelText(/Digit ke-1/)
  await userEvent.type(firstDigit, otp)
}

describe('LoginPage', () => {
  it('shows field error from a 422 on email step', async () => {
    on(
      'POST /auth/request-otp',
      fail(422, 'VALIDATION_ERROR', 'Validation failed', {
        fields: { email: ['Format email tidak valid.'] },
      }),
    )
    await submitEmail('bukan-email')
    expect(await screen.findByText('Format email tidak valid.')).toBeInTheDocument()
  })

  it('shows clear message on 401 wrong OTP code', async () => {
    on('POST /auth/verify-otp', fail(401, 'UNAUTHENTICATED', 'Kode OTP salah atau kedaluwarsa.'))
    await login('admin@example.com', '999999')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kode verifikasi salah atau sudah kedaluwarsa.',
    )
  })

  it('refuses a deactivated account on verification', async () => {
    on(
      'POST /auth/verify-otp',
      fail(403, 'FORBIDDEN', 'Akun Anda dinonaktifkan. Hubungi Admin IT untuk mengaktifkannya.'),
    )
    await login('agus@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent(/dinonaktifkan/)
  })

  it('allows user to change email to go back to step 1', async () => {
    on('POST /auth/request-otp', ok({ message: 'Kode terkirim' }))
    await submitEmail('user@example.com')
    expect(await screen.findByText('user@example.com')).toBeInTheDocument()

    const changeBtn = screen.getByRole('button', { name: /Ganti email/ })
    await userEvent.click(changeBtn)

    expect(screen.getByRole('button', { name: /Kirim kode/ })).toBeInTheDocument()
  })

  it('Admin IT lands on the overview with the admin menu', async () => {
    signedIn('admin')
    on('POST /auth/verify-otp', ok({ token: 't-admin', user: users.admin }))
    await login('admin@example.com')

    expect(await screen.findByRole('heading', { name: 'Ringkasan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log gabungan' })).toBeInTheDocument()
    // Every call after login carries the new token.
    expect(
      calls
        .filter((c) => c.url !== '/auth/request-otp' && c.url !== '/auth/verify-otp')
        .map((c) => c.headers.Authorization),
    ).toContain('Bearer t-admin')
  })

  it('User lands on a plain home without admin items', async () => {
    signedIn('user')
    on('POST /auth/verify-otp', ok({ token: 't-user', user: users.user }))
    await login('user@example.com')

    expect(await screen.findByRole('heading', { name: /Halo, Budi/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log gabungan' })).not.toBeInTheDocument()
  })

  it('shows unregistered prompt with Sign Up link when email is not registered', async () => {
    on(
      'POST /auth/request-otp',
      fail(404, 'NOT_FOUND', 'Email belum terdaftar di sistem. Silakan daftar terlebih dahulu.'),
    )
    await submitEmail('belumterdaftar@example.com')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Email Belum Terdaftar/i)
    expect(within(alert).getByRole('link', { name: /Daftar Sekarang/i })).toHaveAttribute(
      'href',
      '/register?email=belumterdaftar%40example.com',
    )
  })

  it('shows unregistered warning with signup CTA when /login receives account_not_registered', async () => {
    renderApp('/login?error=account_not_registered&reason=account_not_registered')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Email Belum Terdaftar/i)
    expect(within(alert).getByRole('link', { name: /Daftar Sekarang/i })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('shows unregistered warning even if only error=account_not_registered is passed', async () => {
    renderApp('/login?error=account_not_registered')

    expect(await screen.findByRole('alert')).toHaveTextContent(/Email Belum Terdaftar/i)
  })

  it('keeps submit button disabled and blocks submission until reCAPTCHA is verified', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText(/Email/), 'test@example.com')

    const submitBtn = screen.getByRole('button', { name: /Kirim kode/ })
    expect(submitBtn).toBeDisabled()

    const captcha = screen.getByRole('button', { name: /Verifikasi Saya bukan robot/ })
    await userEvent.click(captcha)

    expect(submitBtn).not.toBeDisabled()
  })
})
