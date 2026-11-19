import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { calls, fail, ok, on, signedIn, users } from '../../test/api'
import { renderApp } from '../../test/utils'

async function login(email: string, password = 'rahasia-uji') {
  renderApp('/login')
  await userEvent.type(await screen.findByLabelText(/Email/), email)
  await userEvent.type(screen.getByLabelText(/Sandi/), password)
  await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
}

describe('LoginPage', () => {
  it('shows field errors from a 422', async () => {
    on(
      'POST /auth/login',
      fail(422, 'VALIDATION_ERROR', 'x', {
        fields: { email: ['Email wajib diisi.'], password: ['Sandi wajib diisi.'] },
      }),
    )
    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText('Email wajib diisi.')).toBeInTheDocument()
    expect(screen.getByText('Sandi wajib diisi.')).toBeInTheDocument()
  })

  it('shows one generic message on 401', async () => {
    on('POST /auth/login', fail(401, 'UNAUTHENTICATED', 'Email atau sandi salah.'))
    await login('admin@example.com', 'salah')
    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau sandi salah.')
  })

  it('refuses a deactivated account with a clear message', async () => {
    on('POST /auth/login', fail(403, 'FORBIDDEN', 'Akun Anda dinonaktifkan. Hubungi Admin IT.'))
    await login('agus@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent(/dinonaktifkan/)
  })

  it('Admin IT lands on the overview with the admin menu', async () => {
    signedIn('admin')
    on('POST /auth/login', ok({ token: 't-admin', user: users.admin }))
    await login('admin@example.com')
    expect(await screen.findByRole('heading', { name: 'Ringkasan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log gabungan' })).toBeInTheDocument()
    // Every call after login carries the new token.
    expect(
      calls.filter((c) => c.url !== '/auth/login').map((c) => c.headers.Authorization),
    ).toContain('Bearer t-admin')
  })

  it('User lands on a plain home without admin items', async () => {
    signedIn('user')
    on('POST /auth/login', ok({ token: 't-user', user: users.user }))
    await login('user@example.com')
    expect(await screen.findByRole('heading', { name: /Halo, Budi/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log gabungan' })).not.toBeInTheDocument()
  })
})
