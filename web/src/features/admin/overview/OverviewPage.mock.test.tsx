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
  })
})
