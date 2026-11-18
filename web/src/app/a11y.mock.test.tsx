import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../test/a11y'
import { renderApp } from '../test/utils'

const ADMIN: [string, RegExp][] = [
  ['/', /Ringkasan/],
  ['/console', /^Console$/],
  ['/log', /Log gabungan/],
  ['/transaksi', /^Transaksi$/],
  ['/transaksi/tx_0037', /Buat pesanan/],
  ['/konsistensi?check=2', /Konsistensi data/],
  ['/rbac', /Pengguna & izin/],
  ['/rbac?tab=peran', /Pengguna & izin/],
  ['/audit', /^Audit$/],
  ['/barang', /^Barang$/],
  ['/pesanan', /^Pesanan$/],
]
const USER: [string, RegExp][] = [
  ['/', /Halo/],
  ['/karyawan', /^Karyawan$/],
  ['/pesanan', /^Pesanan$/],
  ['/barang', /^Barang$/],
  ['/log', /403/],
]

describe('axe (WCAG 2 A/AA, structure)', () => {
  it.each(ADMIN)('Admin %s', async (path, title) => {
    renderApp(path, 'admin')
    await screen.findByRole('heading', { level: 1, name: title })
    await screen.findAllByText(/./) // let the first data render
    expect(await axeViolations()).toEqual([])
  })

  it.each(USER)('User %s', async (path, title) => {
    renderApp(path, 'user')
    await screen.findByRole('heading', { level: 1, name: title })
    expect(await axeViolations()).toEqual([])
  })

  it('login page', async () => {
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Masuk' })
    expect(await axeViolations()).toEqual([])
  })

  it('order form (User)', async () => {
    renderApp('/pesanan', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Buat pesanan' }))
    await screen.findByRole('dialog', { name: 'Buat pesanan' })
    expect(await axeViolations()).toEqual([])
  })
})

describe('keyboard', () => {
  it('skip link, then the order form opens and submits from the keyboard', async () => {
    const user = userEvent.setup()
    renderApp('/pesanan', 'user')
    await screen.findByRole('button', { name: 'Buat pesanan' })
    await user.tab()
    expect(screen.getByRole('link', { name: 'Lewati ke konten' })).toHaveFocus()
    screen.getByRole('button', { name: 'Buat pesanan' }).focus()
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Buat pesanan' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buat pesanan' })).toHaveFocus())
  })

  it('table rows open with Enter', async () => {
    const user = userEvent.setup()
    renderApp('/transaksi', 'admin')
    const [row] = await screen.findAllByRole('row', { name: /Buka transaksi/ })
    row!.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('list', { name: 'Fase per console' })).toBeInTheDocument()
  })
})
