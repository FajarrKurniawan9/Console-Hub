import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../../../mocks/scenarios'
import { renderApp } from '../../../test/utils'

describe('Konsistensi', () => {
  it('shows the history and the 2 findings of the barang check', async () => {
    renderApp('/konsistensi?check=2', 'admin')
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(/SKU-BB-002.*Produksi.*Versi berbeda/)
    expect(rows[1]).toHaveTextContent(/SKU-BJ-005.*HR.*Hilang/)
  })

  it('repairs a finding after confirming that the owner data is copied', async () => {
    renderApp('/konsistensi?check=2', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: /Perbaiki .*SKU-BJ-005/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Data dari pemilik akan disalin ke HR')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Perbaiki' }))
    await waitFor(() => expect(screen.getAllByText('Diperbaiki')).toHaveLength(1), {
      timeout: 4000,
    })
  })

  it('drift scenario: a new karyawan check finds a missing row and a checksum mismatch', async () => {
    setScenario('drift')
    renderApp('/konsistensi', 'admin')
    await userEvent.selectOptions(await screen.findByLabelText('Entitas'), 'karyawan')
    await userEvent.click(screen.getByRole('button', { name: 'Periksa sekarang' }))
    const table = await screen.findByRole('table')
    expect(table).toHaveTextContent(/E-0004 Agus Prasetyo.*Gudang.*Hilang/)
    expect(table).toHaveTextContent(/E-0009 Ratna Kusuma.*Produksi.*Checksum berbeda/)
  })

  it('a clean check says so', async () => {
    renderApp('/konsistensi', 'admin')
    await userEvent.selectOptions(await screen.findByLabelText('Entitas'), 'divisi')
    await userEvent.click(screen.getByRole('button', { name: 'Periksa sekarang' }))
    expect(await screen.findByText(/Bersih. Semua salinan sama/)).toBeInTheDocument()
  })
})

describe('?verify=all on admin work pages', () => {
  it('Barang detail shows "Berbeda di Produksi" with versions per console', async () => {
    renderApp('/barang', 'admin')
    await userEvent.click(await screen.findByRole('row', { name: /Detail Gula pasir/ }))
    const panel = await screen.findByRole('dialog')
    expect(await within(panel).findByText('Berbeda di Produksi')).toBeInTheDocument()
    expect(panel).toHaveTextContent(/Gudang.*Sama.*v2/)
    expect(panel).toHaveTextContent(/Produksi.*Versi berbeda.*v1/)
  })

  it('an in-sync row says "Sinkron di 3 console"', async () => {
    renderApp('/divisi', 'admin')
    await userEvent.click(await screen.findByRole('row', { name: /Detail divisi HRD/ }))
    expect(await screen.findByText('Sinkron di 3 console')).toBeInTheDocument()
  })

  it('User shell has no detail panel or verify', async () => {
    renderApp('/barang', 'user')
    await screen.findByText('Gula pasir 50 kg')
    expect(screen.queryByRole('row', { name: /Detail/ })).not.toBeInTheDocument()
  })
})
