import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { TrackingResult } from '../../../lib/api/schemas'
import { dedi, fail, joko, kain, kardus, ok, on, page, tenun } from '../../../test/api'
import { renderApp } from '../../../test/utils'

const ref = ({ id, name, role }: typeof joko) => ({ id, name, role })
const full: TrackingResult = {
  item: kain,
  production: tenun,
  responsible: ref(joko),
  courier: ref(dedi),
  warnings: [],
}
const SOURCES = [
  { source: 'gudang', status: 'ok', latency_ms: 40 },
  { source: 'produksi', status: 'ok', latency_ms: 55 },
  { source: 'hr', status: 'ok', latency_ms: 70 },
] as const
const chain = () => screen.findByRole('list', { name: 'Rantai barang' })

describe('Lacak barang', () => {
  it('search → pick → one merged page', async () => {
    renderApp('/lacak', 'user')
    on('GET /items', (c) => page(c.params.get('q') ? [kain] : []))
    on(`GET /tracking/items/${kain.id}`, ok(full))
    await userEvent.type(await screen.findByRole('searchbox'), 'kain kat')
    await userEvent.click(await screen.findByRole('button', { name: /Kain katun/ }))
    const c = await chain()
    await within(c).findByText('Kain katun')
    expect(c).toHaveTextContent('Area Tekstil A')
    expect(c).toHaveTextContent('Joko Susilo · Staf Gudang')
    expect(c).toHaveTextContent('Dedi Kurniawan · Kurir')
  })

  it('Admin: three "Sumber data" rows with status and latency', async () => {
    renderApp(`/lacak/${kain.id}`, 'admin')
    on(`GET /tracking/items/${kain.id}`, ok({ ...full, sources: SOURCES }))
    await within(await chain()).findByText('Kain katun')
    const section = screen.getByRole('heading', { name: 'Sumber data' }).closest('section')!
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((r) => r.textContent),
    ).toEqual(['GudangBerhasil40 ms', 'ProduksiBerhasil55 ms', 'HRBerhasil70 ms'])
  })

  it('User sees no "Sumber data" and no technical words', async () => {
    renderApp(`/lacak/${kain.id}`, 'user')
    on(`GET /tracking/items/${kain.id}`, ok(full))
    await within(await chain()).findByText('Kain katun')
    expect(screen.queryByRole('heading', { name: 'Sumber data' })).not.toBeInTheDocument()
    expect(screen.getByRole('main')).not.toHaveTextContent(/API|console|ms\b/)
  })

  it('HR down: item and origin stay, neutral note, people "Tidak tersedia"', async () => {
    renderApp(`/lacak/${kain.id}`, 'user')
    on(
      `GET /tracking/items/${kain.id}`,
      ok({
        ...full,
        item: { ...kain, responsible: null },
        production: { ...tenun, courier: null },
        responsible: null,
        courier: null,
        warnings: ['Data personel sedang tidak tersedia.'],
      }),
    )
    const c = await chain()
    await within(c).findByText('Kain katun')
    expect(c).toHaveTextContent('Area Tekstil A')
    expect(within(c).getAllByText('Tidak tersedia')).toHaveLength(2)
    expect(screen.getByText('Data personel sedang tidak tersedia.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Gudang down: a clear error with retry, no raw message', async () => {
    renderApp(`/lacak/${kain.id}`, 'user')
    on(
      `GET /tracking/items/${kain.id}`,
      fail(502, 'SOURCE_UNREACHABLE', 'Data sedang tidak dapat diambil.'),
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Layanan sedang bermasalah')
    expect(within(alert).getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
    expect(alert).not.toHaveTextContent(/SOURCE_|HTTP/)
  })

  it('an item without origin or people says so plainly', async () => {
    renderApp(`/lacak/${kardus.id}`, 'user')
    on(
      `GET /tracking/items/${kardus.id}`,
      ok({ item: kardus, production: null, responsible: null, courier: null, warnings: [] }),
    )
    const c = await chain()
    await within(c).findByText('Kardus kemasan besar')
    expect(c).toHaveTextContent('Barang ini tidak punya asal produksi.')
    expect(within(c).queryByText('Tidak tersedia')).not.toBeInTheDocument()
  })

  it('unknown item: not found', async () => {
    renderApp('/lacak/tidak-ada', 'user')
    on('GET /tracking/items/tidak-ada', fail(404, 'NOT_FOUND', 'Barang tidak ditemukan.'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Data tidak ditemukan')
  })
})
