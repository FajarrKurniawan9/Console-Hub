import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../../../mocks/scenarios'
import { renderApp } from '../../../test/utils'

describe('OverviewPage', () => {
  it('puts a dead console first with its last error', async () => {
    setScenario('gudang-down')
    renderApp('/', 'admin')
    const grid = (await screen.findByRole('heading', { name: 'Console' })).closest('section')!
    const cards = await within(grid).findAllByRole('link')
    expect(cards[0]).toHaveTextContent('Gudang')
    expect(cards[0]).toHaveTextContent('Mati')
    expect(cards[0]).toHaveTextContent('ECONNREFUSED')
  })

  it('shows a specific empty state for transactions', async () => {
    setScenario('empty')
    renderApp('/', 'admin')
    expect(await screen.findByText(/Belum ada transaksi/)).toBeInTheDocument()
    expect(await screen.findByText(/Belum ada pemeriksaan/)).toBeInTheDocument()
  })
})

describe('OverviewPage (phase 3)', () => {
  it('needs attention lists the stuck transaction first, max 5 lines', async () => {
    renderApp('/', 'admin')
    const section = (await screen.findByRole('heading', { name: /Perlu perhatian/ })).closest(
      'section',
    )!
    const items = await within(section).findAllByRole('listitem')
    expect(items.length).toBeLessThanOrEqual(5)
    expect(items[0]).toHaveTextContent('Perlu tindakan')
  })

  it('shows transaction counts as small text and the last consistency check', async () => {
    renderApp('/', 'admin')
    expect(await screen.findByText(/Transaksi: .*berhasil/)).toBeInTheDocument()
    expect(await screen.findByText(/Bersih \(12 data\)/)).toBeInTheDocument()
  })
})
