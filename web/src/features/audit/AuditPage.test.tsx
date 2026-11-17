import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/utils'

describe('AuditPage', () => {
  it('shows a change made in the data page with old and new values', async () => {
    renderApp('/data?console=3&resource=prices', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah SKU-BJ-006' }))
    const dialog = await screen.findByRole('dialog')
    const input = within(dialog).getByRole('textbox', { name: 'Harga' })
    await userEvent.clear(input)
    await userEvent.type(input, '160000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await screen.findByText(/Harga SKU-BJ-006 diubah/)

    await userEvent.click(screen.getByRole('link', { name: 'Audit' }))
    const firstRow = (await screen.findAllByRole('row'))[1]!
    expect(firstRow).toHaveTextContent('resource.updated')
    expect(firstRow).toHaveTextContent('SKU-BJ-006')
    expect(firstRow).toHaveTextContent('Rp160.000')
  })

  it('filters by action from the URL', async () => {
    renderApp('/audit?action=auth.login', 'admin')
    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r).toHaveTextContent('auth.login')
  })

  it('backend refuses non-admins even if the page were reached', async () => {
    renderApp('/audit', 'operator')
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
