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

describe('AuditPage (phase 4)', () => {
  it('records a role permission change with what was added and removed', async () => {
    const { recordAudit } = await import('../../../../mocks/data/audit')
    recordAudit(
      { id: 1, name: 'Rina Wulandari' },
      'rbac.role_updated',
      { type: 'role', id: 'user' },
      null,
      {
        changes: { dicabut: { old: ['divisi.view'], new: null } },
      },
    )
    renderApp('/audit?action=rbac.role_updated', 'admin')
    const row = (await screen.findAllByRole('row'))[1]!
    expect(row).toHaveTextContent('rbac.role_updated')
    expect(row).toHaveTextContent('divisi.view')
  })
})
