import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../mocks/scenarios'
import { renderApp } from '../../test/utils'

async function openEdit(sku: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Ubah ${sku}` }))
  return screen.findByRole('dialog')
}

describe('DataPage', () => {
  it('builds columns from the data and marks writable ones', async () => {
    renderApp('/data?console=3&resource=prices', 'operator')
    expect(await screen.findByRole('columnheader', { name: /SKU/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Harga/ })).toContainElement(
      screen.getByLabelText('dapat diubah'),
    )
    expect(screen.getAllByRole('button', { name: /^Ubah SKU-BJ-/ })).toHaveLength(6)
  })

  it('saves a change, updates the row and toasts old and new values', async () => {
    renderApp('/data?console=3&resource=prices', 'operator')
    const dialog = await openEdit('SKU-BJ-004')
    const input = within(dialog).getByRole('textbox', { name: 'Harga' })
    await userEvent.clear(input)
    await userEvent.type(input, '92000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(
      await screen.findByText('Harga SKU-BJ-004 diubah dari Rp87.000 menjadi Rp92.000'),
    ).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /SKU-BJ-004.*Rp92\.000/ })).toBeInTheDocument()
  })

  it('validates on the client before sending', async () => {
    renderApp('/data?console=3&resource=prices', 'operator')
    const dialog = await openEdit('SKU-BJ-001')
    const input = within(dialog).getByRole('textbox', { name: 'Harga' })
    await userEvent.clear(input)
    await userEvent.type(input, '99999')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(within(dialog).getByText('Harus kelipatan Rp500.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows 422 field errors from the console', async () => {
    setScenario('validation-error')
    renderApp('/data?console=2&resource=items', 'operator')
    const dialog = await openEdit('SKU-BB-001')
    const input = within(dialog).getByRole('textbox', { name: 'Stok minimum' })
    await userEvent.clear(input)
    await userEvent.type(input, '300')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText(/Ditolak oleh Web Gudang/)).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Web Gudang menolak perubahan')
  })

  it('replaces the table with a console error when the console is down', async () => {
    setScenario('gudang-down')
    renderApp('/data?console=2&resource=items', 'operator')
    expect(await screen.findByText('Web Gudang tidak dapat dihubungi')).toBeInTheDocument()
    expect(screen.getByText(/CONSOLE_UNREACHABLE/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('searches and pages through the data', async () => {
    renderApp('/data?console=2&resource=items', 'operator')
    expect(await screen.findByText('1–10 dari 15')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }))
    expect(await screen.findByText('11–15 dari 15')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'gula')
    // "Gula pasir" and "Donat gula"; searching resets to page 1.
    expect(await screen.findByText('1–2 dari 2')).toBeInTheDocument()
  })
})
