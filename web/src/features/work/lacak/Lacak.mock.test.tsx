import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { itemId } from '../../../../mocks/data/logistics'
import { setScenario } from '../../../../mocks/scenarios'
import { renderApp } from '../../../test/utils'

const KAIN = itemId(1) // Kain katun: Area Tekstil A · Tenun, Joko (PJ), Dedi (pengantar)
const chain = () => screen.findByRole('list', { name: 'Rantai barang' })

describe('Lacak barang', () => {
  it('search → pick → one merged page', async () => {
    renderApp('/lacak', 'user')
    await userEvent.type(await screen.findByRole('searchbox'), 'kain kat')
    await userEvent.click(await screen.findByRole('button', { name: /Kain katun/ }))
    const c = await chain()
    await within(c).findByText('Kain katun')
    expect(c).toHaveTextContent('Area Tekstil A')
    expect(c).toHaveTextContent('Tenun')
    expect(c).toHaveTextContent('Joko Susilo · Staf Gudang')
    expect(c).toHaveTextContent('Dedi Kurniawan · Kurir')
  })

  it('ok (Admin): three "Sumber data" rows with status and latency', async () => {
    renderApp(`/lacak/${KAIN}`, 'admin')
    await within(await chain()).findByText('Kain katun')
    const section = screen.getByRole('heading', { name: 'Sumber data' }).closest('section')!
    const rows = within(section).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^GudangBerhasil\d+ ms$/),
      expect.stringMatching(/^ProduksiBerhasil\d+ ms$/),
      expect.stringMatching(/^HRBerhasil\d+ ms$/),
    ])
  })

  it('User sees no "Sumber data" and no technical words', async () => {
    renderApp(`/lacak/${KAIN}`, 'user')
    await within(await chain()).findByText('Kain katun')
    expect(screen.queryByRole('heading', { name: 'Sumber data' })).not.toBeInTheDocument()
    expect(screen.getByRole('main')).not.toHaveTextContent(/API|console|ms\b/)
  })

  it('hr-down: item and origin stay, neutral note, people "Tidak tersedia"', async () => {
    setScenario('hr-down')
    renderApp(`/lacak/${KAIN}`, 'user')
    const c = await chain()
    await within(c).findByText('Kain katun')
    expect(c).toHaveTextContent('Area Tekstil A')
    expect(within(c).getAllByText('Tidak tersedia')).toHaveLength(2)
    const note = screen.getByText('Data personel sedang tidak tersedia.')
    expect(note.closest('ul')).not.toHaveClass('border-error')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hr-down (Admin): HR row says "Tidak tersedia" without latency', async () => {
    setScenario('hr-down')
    renderApp(`/lacak/${KAIN}`, 'admin')
    await within(await chain()).findByText('Kain katun')
    const section = screen.getByRole('heading', { name: 'Sumber data' }).closest('section')!
    expect(within(section).getAllByRole('listitem')[2]).toHaveTextContent('HRTidak tersedia—')
  })

  it('all-down: a clear error with retry, no raw message', async () => {
    setScenario('all-down')
    renderApp(`/lacak/${KAIN}`, 'user')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Layanan sedang bermasalah')
    expect(within(alert).getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
    expect(alert).not.toHaveTextContent(/SOURCE_|ECONNREFUSED|HTTP/)
  })

  it('shows a loading state per step while the sources answer', async () => {
    renderApp(`/lacak/${KAIN}`, 'user')
    expect(await screen.findByRole('status', { name: 'Memuat data personel' })).toBeInTheDocument()
    await within(await chain()).findByText('Kain katun')
  })

  it('an item without origin or people says so plainly', async () => {
    renderApp(`/lacak/${itemId(14)}`, 'user') // Kardus kemasan besar
    const c = await chain()
    await within(c).findByText('Kardus kemasan besar')
    expect(c).toHaveTextContent('Barang ini tidak punya asal produksi.')
    expect(within(c).queryByText('Tidak tersedia')).not.toBeInTheDocument()
  })

  it('unknown item: not found', async () => {
    renderApp('/lacak/tidak-ada', 'user')
    expect(await screen.findByRole('alert')).toHaveTextContent('Data tidak ditemukan')
  })
})
