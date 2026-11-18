import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../mocks/scenarios'
import { renderApp } from '../../test/utils'

describe('OverviewPage', () => {
  it('puts a dead console first with its last error', async () => {
    setScenario('gudang-down')
    renderApp('/', 'operator')
    await screen.findByText(/Mati sejak/)
    const grid = screen.getByRole('heading', { name: 'Console' }).closest('section')!
    const cards = within(grid).getAllByRole('link')
    expect(cards[0]).toHaveTextContent('Web Gudang')
    expect(cards[0]).toHaveTextContent('Mati')
    expect(cards[0]).toHaveTextContent('ECONNREFUSED')
  })

  it('lists at most 5 items that need attention and 5 recent runs', async () => {
    renderApp('/', 'operator')
    await screen.findByText(/log error dalam 24 jam/)
    const heading = screen.getByRole('heading', { name: /Perlu perhatian/ })
    const section = heading.closest('section')!
    const items = await within(section).findAllByRole('listitem')
    expect(items.length).toBeLessThanOrEqual(5)
    expect(await screen.findAllByRole('row', { name: /Eksekusi run_/ })).toHaveLength(5)
  })

  it('shows specific empty states', async () => {
    setScenario('empty')
    renderApp('/', 'operator')
    expect(await screen.findByText(/Belum ada eksekusi/)).toBeInTheDocument()
    expect(await screen.findByText(/Tidak ada log error atau eksekusi gagal/)).toBeInTheDocument()
  })
})
