import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fail, on, page, sources } from '../test/api'
import { renderApp } from '../test/utils'

// Every failure the hub can answer must give a sensible screen (no blank page, no uncaught error).

describe('forbidden', () => {
  it('Admin: logs refused by the server show a clear 403 message', async () => {
    renderApp('/log', 'admin')
    on('GET /admin/logs', fail(403, 'FORBIDDEN', 'Anda tidak memiliki izin untuk tindakan ini.'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tidak punya izin')
    expect(alert).toHaveTextContent('FORBIDDEN')
  })

  it('User: Barang refused shows plain words', async () => {
    renderApp('/barang', 'user')
    on('GET /items', fail(403, 'FORBIDDEN', 'x'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Anda tidak punya akses')
    expect(alert).not.toHaveTextContent(/FORBIDDEN|HTTP/)
  })
})

describe('rate limited', () => {
  it('a 429 says to wait', async () => {
    renderApp('/barang', 'admin')
    on('GET /items', fail(429, 'RATE_LIMITED', 'Terlalu banyak permintaan.'))
    expect(await screen.findByText('Terlalu banyak permintaan')).toBeInTheDocument()
  })
})

describe('all sources down', () => {
  it('Admin: three bars, three dead cards', async () => {
    renderApp('/', 'admin')
    on('GET /admin/consoles', page(sources(['hr', 'gudang', 'produksi'])))
    on('GET /admin/overview', {
      body: {
        data: {
          sources: sources(['hr', 'gudang', 'produksi']),
          log_errors_24h: 0,
          recent_audit: [],
        },
      },
    })
    expect(await screen.findAllByText(/tidak dapat dihubungi sejak/)).toHaveLength(3)
    const grid = screen.getByRole('heading', { name: 'Sumber data' }).closest('section')!
    expect(within(grid).getAllByText('Mati')).toHaveLength(3)
  })

  it('User: work lists fail with plain words, no source names', async () => {
    renderApp('/barang', 'user')
    on('GET /items', fail(502, 'SOURCE_UNREACHABLE', 'Data sedang tidak dapat diambil.'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Layanan sedang bermasalah')
    // "Produksi" is a menu item for User; source names must not appear in messages.
    expect(screen.getByRole('main')).not.toHaveTextContent(/\bHR\b|Gudang|SOURCE_|API/)
  })
})

describe('network', () => {
  it('offline bar appears when the browser goes offline', async () => {
    renderApp('/barang', 'user')
    await screen.findByRole('heading', { name: 'Barang' })
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
