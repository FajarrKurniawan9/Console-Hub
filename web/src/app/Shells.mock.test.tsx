import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../mocks/scenarios'
import { renderApp } from '../test/utils'

describe('shells and guards', () => {
  it('redirects to login without a session', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })

  it.each(['/log', '/console', '/transaksi', '/rbac', '/audit', '/konsistensi'])(
    'User opening %s directly gets 403',
    async (path) => {
      renderApp(path, 'user')
      expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
      expect(screen.getByText(/hubungi admin IT/)).toBeInTheDocument()
    },
  )

  it('User menu hides what the role cannot see', async () => {
    renderApp('/', 'user')
    await screen.findByRole('heading', { name: /Halo/ })
    // Default User role has divisi.view but no admin permissions.
    expect(screen.getByRole('link', { name: 'Divisi' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument()
  })

  it('Admin sees a global bar when a console is down', async () => {
    setScenario('gudang-down')
    renderApp('/', 'admin')
    expect(await screen.findByText(/tidak dapat dihubungi sejak/)).toHaveTextContent('Gudang')
    expect(screen.getByRole('link', { name: 'Lihat console' })).toHaveAttribute(
      'href',
      '/console/2',
    )
  })

  it('User never sees the console-down bar', async () => {
    setScenario('gudang-down')
    renderApp('/', 'user')
    await screen.findByRole('heading', { name: /Halo/ })
    expect(screen.queryByText(/tidak dapat dihubungi/)).not.toBeInTheDocument()
  })
})
