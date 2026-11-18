import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../mocks/scenarios'
import { renderApp } from '../test/utils'

// Every scenario in brief §9 must give a sensible screen (no blank page, no uncaught error).

describe('scenario: unauthenticated', () => {
  it('after login every call is 401: back to login with a "sesi berakhir" note', async () => {
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText(/Email/), 'user@example.com')
    await userEvent.type(screen.getByLabelText(/Sandi/), 'demo12345')
    setScenario('unauthenticated')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText(/Sesi Anda sudah berakhir/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })

  it('a stored session that expires sends you to login', async () => {
    setScenario('unauthenticated')
    renderApp('/pesanan', 'user')
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })
})

describe('scenario: forbidden', () => {
  it('Admin: logs refused by the server show a clear 403 message, not a blank page', async () => {
    setScenario('forbidden')
    renderApp('/log', 'admin')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tidak punya izin')
    expect(alert).toHaveTextContent('FORBIDDEN')
  })

  it('User: Barang refused shows plain words', async () => {
    setScenario('forbidden')
    renderApp('/barang', 'user')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Anda tidak punya akses')
    expect(alert).not.toHaveTextContent(/FORBIDDEN|HTTP/)
  })
})

describe('scenario: rate-limited', () => {
  it('pages still load (one automatic retry), and a final 429 says to wait', async () => {
    setScenario('rate-limited')
    renderApp('/transaksi', 'admin')
    await waitFor(
      () =>
        expect(
          screen.queryAllByRole('row', { name: /Buka transaksi/ }).length +
            screen.queryAllByText('Terlalu banyak permintaan').length,
        ).toBeGreaterThan(0),
      { timeout: 8000 },
    )
  }, 10_000)
})

describe('scenario: all-down', () => {
  it('Admin: three bars, three dead cards', async () => {
    setScenario('all-down')
    renderApp('/', 'admin')
    expect(await screen.findAllByText(/tidak dapat dihubungi sejak/)).toHaveLength(3)
    const grid = screen.getByRole('heading', { name: 'Console' }).closest('section')!
    expect(within(grid).getAllByText('Mati')).toHaveLength(3)
  })

  it('User: work lists fail with one plain banner, writes refused', async () => {
    setScenario('all-down')
    renderApp('/pesanan', 'user')
    expect(await screen.findByText(/Sebagian layanan sedang bermasalah/)).toBeInTheDocument()
    const alert = screen.getAllByRole('alert')[0]!
    expect(alert).toHaveTextContent('Layanan sedang bermasalah')
    expect(document.body).not.toHaveTextContent(/HR|Gudang|Produksi|CONSOLE_/)
  })
})

describe('network', () => {
  it('offline bar appears when the browser goes offline', async () => {
    renderApp('/pesanan', 'user')
    await screen.findByRole('heading', { name: 'Pesanan' })
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    act(() => void window.dispatchEvent(new Event('offline')))
    expect(await screen.findByText(/Koneksi internet terputus/)).toBeInTheDocument()
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    act(() => void window.dispatchEvent(new Event('online')))
    await waitFor(() =>
      expect(screen.queryByText(/Koneksi internet terputus/)).not.toBeInTheDocument(),
    )
  })
})
