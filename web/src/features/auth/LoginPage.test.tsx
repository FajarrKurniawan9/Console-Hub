import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/utils'

describe('LoginPage', () => {
  it('shows field errors from a 422', async () => {
    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText('Email wajib diisi.')).toBeInTheDocument()
    expect(screen.getByText('Sandi wajib diisi.')).toBeInTheDocument()
  })

  it('shows one generic message on 401', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText(/Email/), 'rina@pabrik-sejahtera.id')
    await userEvent.type(screen.getByLabelText(/Sandi/), 'salah')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau sandi salah.')
  })

  it('logs in and lands on the overview', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText(/Email/), 'budi@pabrik-sejahtera.id')
    await userEvent.type(screen.getByLabelText(/Sandi/), 'konsol123')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByRole('heading', { name: 'Ringkasan' })).toBeInTheDocument()
    // Operator does not see the admin menu.
    expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument()
  })
})
