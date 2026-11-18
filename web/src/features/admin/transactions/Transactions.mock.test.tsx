import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { transactions } from '../../../../mocks/engine/transactions'
import { setScenario } from '../../../../mocks/scenarios'
import { renderApp } from '../../../test/utils'

const stuck = () => transactions.find((t) => t.state === 'needs_attention')!

describe('Transaksi', () => {
  it('lists the seeded history with status, operation, trigger and reason', async () => {
    renderApp('/transaksi', 'admin')
    const rows = await screen.findAllByRole('row', { name: /Buka transaksi tx_/ })
    expect(rows).toHaveLength(40)
    expect(screen.getByText(/40 transaksi/)).toBeInTheDocument()
    expect(screen.getAllByText('Perlu tindakan')).toHaveLength(1)
    expect(screen.getAllByText(/INSUFFICIENT_STOCK|stok .* tidak cukup/).length).toBeGreaterThan(0)
  })

  it('filters by status from the URL', async () => {
    renderApp('/transaksi?state=aborted', 'admin')
    const rows = await screen.findAllByRole('row', { name: /Buka transaksi/ })
    for (const r of rows) expect(within(r).getByText('Dibatalkan')).toBeInTheDocument()
  })

  it('detail shows three consoles with their prepare and decision phases', async () => {
    const tx = transactions.find((t) => t.failure_code === 'INSUFFICIENT_STOCK')!
    renderApp(`/transaksi/${tx.id}`, 'admin')
    const strip = await screen.findByRole('list', { name: 'Fase per console' })
    const boxes = within(strip).getAllByRole('listitem')
    expect(boxes.map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^HR.*Prepare.*setuju.*Batal.*dibatalkan/),
      expect.stringMatching(/^Gudang.*Prepare.*menolak/),
      expect.stringMatching(/^Produksi.*Prepare.*setuju/),
    ])
    expect(screen.getByText('INSUFFICIENT_STOCK', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Garis waktu')).toBeInTheDocument()
  })

  it('needs_attention: retry commit after confirmation, then polls to committed', async () => {
    renderApp(`/transaksi/${stuck().id}`, 'admin')
    expect(await screen.findByText(/Transaksi ini perlu diselesaikan/)).toBeInTheDocument()
    expect(
      screen.getByText(/Transaksi ini perlu diselesaikan/).closest('[role=alert]'),
    ).toHaveTextContent('Produksi belum menerapkannya')
    await userEvent.click(screen.getByRole('button', { name: 'Coba commit ulang' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Console yang sudah commit tidak disentuh')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Coba commit ulang' }))
    await waitFor(() => expect(screen.getAllByText('Berhasil').length).toBeGreaterThan(0), {
      timeout: 5000,
    })
    expect(screen.queryByText(/Transaksi ini perlu diselesaikan/)).not.toBeInTheDocument()
  })

  it('needs_attention: abort cancels every console', async () => {
    const id = stuck().id
    renderApp(`/transaksi/${id}`, 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Batalkan transaksi' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('termasuk console yang sudah commit')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Batalkan transaksi' }))
    await waitFor(() => expect(transactions.find((t) => t.id === id)!.state).toBe('aborted'))
    expect(
      transactions
        .find((t) => t.id === id)!
        .participants.every((p) => p.decision_state === 'aborted'),
    ).toBe(true)
  })

  it('a write in commit-stuck shows up as needs_attention for Admin', async () => {
    setScenario('commit-stuck')
    renderApp('/divisi', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Keuangan' }))
    const dialog = await screen.findByRole('dialog')
    const nama = within(dialog).getByLabelText(/Nama/)
    await userEvent.clear(nama)
    await userEvent.type(nama, 'Keuangan & Pajak')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    const alert = await within(dialog).findByRole('alert', {}, { timeout: 6000 })
    const link = within(alert).getByRole('link', { name: /^tx_/ })
    await userEvent.click(link)
    expect(await screen.findByRole('button', { name: 'Coba commit ulang' })).toBeInTheDocument()
  }, 10_000)

  it('empty scenario: a specific empty state', async () => {
    setScenario('empty')
    renderApp('/transaksi', 'admin')
    expect(await screen.findByText(/Belum ada transaksi. Transaksi tercatat/)).toBeInTheDocument()
  })
})
