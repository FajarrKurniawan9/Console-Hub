import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { calls, fail, ok, on, signedIn, users } from '../../test/api'
import { renderApp } from '../../test/utils'

async function submitRegisterForm(name: string, email: string) {
  renderApp('/register')
  await userEvent.type(await screen.findByLabelText(/Nama lengkap/), name)
  await userEvent.type(screen.getByLabelText(/Email/), email)
  const captcha = screen.queryByRole('button', { name: /Verifikasi Saya bukan robot/ })
  if (captcha) {
    await userEvent.click(captcha)
  }
  await userEvent.click(screen.getByRole('button', { name: /Kirim kode/ }))
}

describe('RegisterPage', () => {
  it('keeps submit button disabled until name, email, and reCAPTCHA are filled', async () => {
    renderApp('/register')

    const submitBtn = await screen.findByRole('button', { name: /Kirim kode/ })
    expect(submitBtn).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/Nama lengkap/), 'Dewi Lestari')
    await userEvent.type(screen.getByLabelText(/Email/), 'dewi@example.com')
    expect(submitBtn).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /Verifikasi Saya bukan robot/ }))
    expect(submitBtn).not.toBeDisabled()
  })

  it('validates minimum name length before sending OTP request', async () => {
    renderApp('/register')
    await userEvent.type(await screen.findByLabelText(/Nama lengkap/), 'Ab')
    await userEvent.type(screen.getByLabelText(/Email/), 'ab@example.com')
    await userEvent.click(screen.getByRole('button', { name: /Verifikasi Saya bukan robot/ }))
    await userEvent.click(screen.getByRole('button', { name: /Kirim kode/ }))

    expect(await screen.findByText('Nama lengkap minimal 3 huruf.')).toBeInTheDocument()
    expect(calls.filter((c) => c.url === '/auth/register/request-otp')).toHaveLength(0)
  })

  it('completes registration with email OTP verification and logs straight into User HomePage', async () => {
    signedIn('user')
    on(
      'POST /auth/register/request-otp',
      ok({
        message: 'Kode verifikasi pendaftaran telah dikirim ke email Anda.',
        expires_in: 300,
        resend_token: 'resend-tok-1',
      }),
    )
    on('POST /auth/register/verify', ok({ token: 't-new-user', user: users.user }, 201))

    await submitRegisterForm('Budi Santoso', 'budi.baru@example.com')

    expect(await screen.findByText('budi.baru@example.com')).toBeInTheDocument()
    expect(screen.getByText(/Kode verifikasi pendaftaran telah dikirim/)).toBeInTheDocument()

    const firstDigit = await screen.findByLabelText(/Digit ke-1/)
    await userEvent.type(firstDigit, '654321')

    expect(await screen.findByRole('heading', { name: /Halo, Budi/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log gabungan' })).not.toBeInTheDocument()

    const verifyCall = calls.find((c) => c.url === '/auth/register/verify')
    expect(verifyCall?.body).toEqual({
      name: 'Budi Santoso',
      email: 'budi.baru@example.com',
      otp: '654321',
    })
  })

  it('shows field validation error when email is already registered', async () => {
    on(
      'POST /auth/register/request-otp',
      fail(422, 'VALIDATION_ERROR', 'Email ini sudah terdaftar.', {
        fields: { email: ['Email ini sudah terdaftar. Silakan masuk melalui halaman login.'] },
      }),
    )

    await submitRegisterForm('Dewi Lestari', 'sudahada@example.com')

    expect(
      await screen.findByText('Email ini sudah terdaftar. Silakan masuk melalui halaman login.'),
    ).toBeInTheDocument()
  })

  it('redirects unregistered Google OAuth callback straight to prefilled /register and sends signup_token', async () => {
    signedIn('user')
    on('POST /auth/register/request-otp', ok({ message: 'Kode dikirim.' }))
    on('POST /auth/register/verify', ok({ token: 't-google-new', user: users.user }, 201))

    renderApp(
      '/auth/google/callback?error=account_not_registered&email=outsider%40example.com&name=Outsider+User&signup_token=tok-google-99',
    )

    expect(await screen.findByRole('heading', { name: 'Daftar Akun' })).toBeInTheDocument()
    expect(screen.getByText(/Akun Google Anda belum terdaftar/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nama lengkap/)).toHaveValue('Outsider User')
    expect(screen.getByLabelText(/Email/)).toHaveValue('outsider@example.com')

    await userEvent.click(screen.getByRole('button', { name: /Verifikasi Saya bukan robot/ }))
    await userEvent.click(screen.getByRole('button', { name: /Kirim kode/ }))

    const firstDigit = await screen.findByLabelText(/Digit ke-1/)
    await userEvent.type(firstDigit, '112233')

    expect(await screen.findByRole('heading', { name: /Halo, Budi/ })).toBeInTheDocument()

    const verifyCall = calls.find((c) => c.url === '/auth/register/verify')
    expect(verifyCall?.body).toEqual({
      name: 'Outsider User',
      email: 'outsider@example.com',
      otp: '112233',
      signup_token: 'tok-google-99',
    })
  })
})
