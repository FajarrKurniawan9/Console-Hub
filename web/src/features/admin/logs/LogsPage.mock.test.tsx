import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../../../mocks/scenarios'
import { renderApp } from '../../../test/utils'

describe('LogsPage', () => {
  it('lists logs newest first with time, console, level and message', async () => {
    renderApp('/log', 'admin')
    const rows = await screen.findAllByRole('row', { name: /Buka log/ })
    expect(rows.length).toBe(50)
    const ids = rows.map((r) => Number(r.getAttribute('aria-label')!.replace(/\D/g, '')))
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
    expect(within(rows[0]!).getByText(/^(HR|Gudang|Produksi)$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Muat lebih banyak' })).toBeInTheDocument()
  })

  it('filters by level from the URL and shows only that level', async () => {
    renderApp('/log?level=error&range=7d', 'admin')
    const rows = await screen.findAllByRole('row', { name: /Buka log/ })
    for (const r of rows) expect(within(r).getByText('Error')).toBeInTheDocument()
  })

  it('shows a specific empty state with a clear-filter action', async () => {
    renderApp('/log?q=tidak-ada-yang-cocok', 'admin')
    expect(await screen.findByText('Tidak ada log yang cocok dengan filter.')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /Hapus filter/ }).at(-1)!)
    expect(await screen.findAllByRole('row', { name: /Buka log/ })).not.toHaveLength(0)
  })

  it('warns that a dead console may lag while other logs still load', async () => {
    setScenario('gudang-down')
    renderApp('/log', 'admin')
    expect(await screen.findByText(/mungkin tertinggal/)).toHaveTextContent('Gudang')
    expect(await screen.findAllByRole('row', { name: /Buka log/ })).not.toHaveLength(0)
  })

  it('opens the detail panel with raw data', async () => {
    renderApp('/log', 'admin')
    const [first] = await screen.findAllByRole('row', { name: /Buka log/ })
    await userEvent.click(first!)
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/Data mentah dari/)).toBeInTheDocument()
  })

  it('reports per-console pull results, including the failure reason', async () => {
    setScenario('gudang-down')
    renderApp('/log', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: /Tarik sekarang/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Semua console' }))
    const result = await screen.findByText('Hasil tarik log')
    const box = result.closest('[role=status]') as HTMLElement
    expect(within(box).getByText(/gagal\. Tidak dapat dihubungi/)).toBeInTheDocument()
    expect(within(box).getAllByText(/berhasil/)).toHaveLength(2)
  })
})
