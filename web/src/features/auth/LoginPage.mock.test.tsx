import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PASSWORD } from '../../../mocks/data/users'
import { renderApp } from '../../test/utils'

async function login(email: string, password = PASSWORD) {
  renderApp('/login')
  await userEvent.type(await screen.findByLabelText(/Email/), email)
  await userEvent.type(screen.getByLabelText(/Sandi/), password)
  await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
}

describe('LoginPage', () => {
  it('shows field errors from a 422', async () => {
    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText('Email wajib diisi.')).toBeInTheDocument()
    expect(screen.getByText('Sandi wajib diisi.')).toBeInTheDocument()
  })

  it('shows one generic message on 401', async () => {
    await login('admin@example.com', 'salah')
    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau sandi salah.')
  })

  it('refuses a deactivated account with a clear message', async () => {
    await login('agus@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent(/dinonaktifkan/)
  })

  it('Admin IT lands on the overview with the admin menu', async () => {
    await login('admin@example.com')
    expect(await screen.findByRole('heading', { name: 'Ringkasan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log gabungan' })).toBeInTheDocument()
  })

  it('User lands on a plain home without admin items', async () => {
    await login('user@example.com')
    expect(await screen.findByRole('heading', { name: /Halo, Budi/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Barang' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log gabungan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ringkasan' })).not.toBeInTheDocument()
  })
})
