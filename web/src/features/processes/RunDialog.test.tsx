import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../mocks/scenarios'
import { renderApp } from '../../test/utils'

async function openDialog() {
  renderApp('/processes/1', 'operator')
  await userEvent.click(await screen.findByRole('button', { name: 'Jalankan' }))
  return screen.findByRole('dialog')
}

describe('Process run dialog', () => {
  it('builds the form from input_schema and validates required and min', async () => {
    const dialog = await openDialog()
    expect(within(dialog).getByLabelText(/Nama pelanggan/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Jalankan' }))
    expect(within(dialog).getAllByText(/wajib diisi/)).toHaveLength(3)
    await userEvent.type(within(dialog).getByLabelText(/Jumlah/), '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Jalankan' }))
    expect(within(dialog).getByText('Jumlah (karton) minimal 1.')).toBeInTheDocument()
  })

  it('submits and goes to the run page', async () => {
    const dialog = await openDialog()
    await userEvent.type(within(dialog).getByLabelText(/Nama pelanggan/), 'Toko Roti Makmur')
    await userEvent.type(within(dialog).getByLabelText(/SKU/), 'SKU-BJ-002')
    await userEvent.type(within(dialog).getByLabelText(/Jumlah/), '12')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Jalankan' }))
    expect(
      await screen.findByRole('list', { name: 'Ringkasan status langkah' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/customer="Toko Roti Makmur"/)).toBeInTheDocument()
  })

  it('shows 422 field errors from the backend', async () => {
    setScenario('validation-error')
    const dialog = await openDialog()
    await userEvent.type(within(dialog).getByLabelText(/Nama pelanggan/), 'Toko')
    await userEvent.type(within(dialog).getByLabelText(/SKU/), 'SKU-BJ-002')
    await userEvent.type(within(dialog).getByLabelText(/Jumlah/), '12')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Jalankan' }))
    expect(await within(dialog).findByText(/Ditolak backend/)).toBeInTheDocument()
  })
})
