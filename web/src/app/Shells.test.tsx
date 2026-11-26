import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { calls, fail, on, page, sources } from '../test/api'
import { renderApp } from '../test/utils'

describe('shells and guards', () => {
  it('redirects to login without a session', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })

  it.each(['/log', '/console', '/rbac', '/audit'])(
    'User opening %s directly gets 403',
    async (path) => {
      renderApp(path, 'user')
      expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
      expect(screen.getByText(/hubungi admin IT/)).toBeInTheDocument()
    },
  )

  it('User menu shows the work pages only, and the app never calls /admin/*', async () => {
    renderApp('/', 'user')
    await screen.findByRole('heading', { name: /Halo/ })
    for (const name of ['Barang', 'Produksi', 'Personel', 'Lacak barang'])
      expect(screen.getAllByRole('link', { name })[0]).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument()
    expect(calls.filter((c) => c.url.startsWith('/admin'))).toEqual([])
  })

  it('Admin sees a global bar when a source is down', async () => {
    renderApp('/', 'admin')
    on('GET /admin/consoles', page(sources(['gudang'])))
    on('GET /admin/overview', fail(500, 'SERVER_ERROR'))
    expect(await screen.findByText(/tidak dapat dihubungi sejak/)).toHaveTextContent('Gudang')
    expect(screen.getByRole('link', { name: 'Lihat sumber data' })).toHaveAttribute(
      'href',
      '/console/2',
    )
  })

  it('an expired session sends you to login', async () => {
    renderApp('/barang', 'user')
    on('GET /auth/me', fail(401, 'UNAUTHENTICATED'))
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })

  it('user menu displays username and role without email and navigates to profile', async () => {
    renderApp('/', 'admin')
    const trigger = await screen.findByRole('button', { name: /Menu pengguna: Rina Wulandari/i })
    await userEvent.click(trigger)
    expect(await screen.findByText('Admin IT')).toBeInTheDocument()
    expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('menuitem', { name: /Profile/i }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument()
  })
})

describe('status pages', () => {
  it('shows 404 inside the layout for unknown paths', async () => {
    renderApp('/tidak-ada', 'user')
    expect(await screen.findByRole('heading', { name: /404/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Beranda' })).toHaveAttribute('href', '/')
  })

  it('keeps the title and back link while a detail page fails', async () => {
    renderApp('/console/99', 'admin')
    on('GET /admin/consoles/99', fail(404, 'NOT_FOUND', 'Data tidak ditemukan.'))
    expect(await screen.findByText('Data tidak ditemukan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Semua sumber data/ })).toHaveAttribute(
      'href',
      '/console',
    )
  })
})
