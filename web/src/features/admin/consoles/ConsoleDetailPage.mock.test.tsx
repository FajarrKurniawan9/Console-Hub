import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../../../mocks/scenarios'
import { renderApp } from '../../../test/utils'

describe('ConsoleDetailPage', () => {
  it('tests the connection and shows the result in place', async () => {
    renderApp('/console/1', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Uji koneksi' }))
    expect(await screen.findByText(/Hasil uji: Normal/)).toBeInTheDocument()
  })

  it('explains a dead console and never shows credentials', async () => {
    setScenario('gudang-down')
    renderApp('/console/2', 'admin')
    expect(await screen.findByText(/Tidak dapat dihubungi sejak/)).toBeInTheDocument()
    expect(screen.queryByText(/kredensial|password|api_key/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Uji koneksi' }))
    expect(await screen.findByText(/Hasil uji: Mati/)).toBeInTheDocument()
  })

  it('shows a 404 error state for an unknown console', async () => {
    renderApp('/console/99', 'admin')
    expect(await screen.findByText('Data tidak ditemukan')).toBeInTheDocument()
  })
})
