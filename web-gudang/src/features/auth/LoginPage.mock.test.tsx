import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/utils'

describe('Login', () => {
  it('mengarahkan ke login tanpa sesi', async () => {
    renderApp('/barang', { loggedIn: false })
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })

  it('masuk dengan akun mock lalu membuka beranda', async () => {
    renderApp('/login', { loggedIn: false })
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'staf@example.com')
    await user.type(screen.getByLabelText('Sandi'), 'demo12345')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByRole('navigation', { name: 'Menu utama' })).toBeInTheDocument()
    expect(screen.getByText('Dewi Lestari')).toBeInTheDocument()
  })

  it('sandi salah menampilkan kalimat biasa', async () => {
    renderApp('/login', { loggedIn: false })
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'staf@example.com')
    await user.type(screen.getByLabelText('Sandi'), 'salah')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau sandi salah.')
  })

  it('validasi form sebelum mengirim', async () => {
    renderApp('/login', { loggedIn: false })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Masuk' }))
    expect(screen.getByText('Email wajib diisi.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})
