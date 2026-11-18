import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../mocks/scenarios'
import { renderApp } from '../test/utils'

describe('AppLayout', () => {
  it('redirects to login without a session', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })

  it('shows a global bar when a console is down, with status as dot + word', async () => {
    setScenario('gudang-down')
    renderApp('/', 'admin')
    expect(await screen.findByText(/tidak dapat dihubungi sejak/)).toHaveTextContent('Web Gudang')
    expect(screen.getByRole('link', { name: 'Lihat console' })).toHaveAttribute(
      'href',
      '/consoles/2',
    )
    expect(await screen.findAllByText('Mati')).not.toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Audit' })).toBeInTheDocument()
  })

  it('shows a clear 403 to non-admins on /audit', async () => {
    renderApp('/audit', 'operator')
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
  })
})
