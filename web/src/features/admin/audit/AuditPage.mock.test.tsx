import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../../test/utils'

describe('AuditPage', () => {
  it('filters by action from the URL', async () => {
    renderApp('/audit?action=auth.login', 'admin')
    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r).toHaveTextContent('auth.login')
  })

  it('shows old and new values for a change', async () => {
    renderApp('/audit?action=barang.update', 'admin')
    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(rows[0]).toHaveTextContent('min_stock')
  })

  it('is 403 for User, and the table never renders', async () => {
    renderApp('/audit', 'user')
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
