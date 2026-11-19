import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setScenario } from '../../../../mocks/scenarios'
import { renderApp } from '../../../test/utils'

const section = async (name: string) =>
  (await screen.findByRole('heading', { name })).closest('section')!

describe('OverviewPage', () => {
  it('three small source cards: name, status dot + word, latency', async () => {
    renderApp('/', 'admin')
    const cards = await within(await section('Sumber data')).findAllByRole('link', {
      name: /HR|Gudang|Produksi/,
    })
    expect(cards).toHaveLength(3)
    for (const c of cards) {
      expect(c).toHaveTextContent(/\d+ ms/)
      expect(c).toHaveTextContent('Normal')
    }
  })

  it('puts a dead source first', async () => {
    setScenario('gudang-down')
    renderApp('/', 'admin')
    const cards = await within(await section('Sumber data')).findAllByRole('link', {
      name: /HR|Gudang|Produksi/,
    })
    expect(cards[0]).toHaveTextContent('Gudang')
    expect(cards[0]).toHaveTextContent('Mati')
  })

  it('error logs in 24 h and recent audit activity', async () => {
    renderApp('/', 'admin')
    expect(await screen.findByText(/log error dalam 24 jam terakhir/)).toBeInTheDocument()
    const audit = await section('Aktivitas terbaru')
    expect((await within(audit).findAllByRole('listitem')).length).toBeGreaterThan(0)
  })

  it('shows only sources, error logs and activity (update 2)', async () => {
    renderApp('/', 'admin')
    await section('Sumber data')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Sumber data', 'Log error', 'Aktivitas terbaru'])
  })

  it('empty: a specific sentence for activity', async () => {
    setScenario('empty')
    renderApp('/', 'admin')
    expect(await screen.findByText(/Belum ada aktivitas/)).toBeInTheDocument()
  })
})
