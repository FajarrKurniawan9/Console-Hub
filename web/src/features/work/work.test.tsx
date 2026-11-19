import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { calls, fail, hendra, joko, kain, ok, on, page, tenun } from '../../test/api'
import { renderApp } from '../../test/utils'

const rowOf = (name: string) => screen.findByRole('row', { name: `Detail ${name}` })
const writes = () => calls.filter((c) => c.method !== 'GET')

describe('Barang', () => {
  it('lists items with merged origin and responsible', async () => {
    renderApp('/barang', 'user')
    const row = await rowOf('Kain katun')
    expect(row).toHaveTextContent('Area Tekstil A · Tenun')
    expect(row).toHaveTextContent('Joko Susilo')
    expect(row).toHaveTextContent('340 m')
  })

  it('empty: a specific sentence', async () => {
    renderApp('/barang', 'user')
    on('GET /items', page([]))
    expect(await screen.findByText(/Belum ada barang/)).toBeInTheDocument()
  })

  it('HR down (User): row intact, "Tidak tersedia", plain banner, writes allowed', async () => {
    renderApp('/barang', 'user')
    on('GET /items', page([{ ...kain, responsible: null }], { unavailable: ['hr'] }))
    const row = await rowOf('Kain katun')
    expect(within(row).getByText('Tidak tersedia')).toBeInTheDocument()
    expect(screen.getByText(/Sebagian keterangan sedang tidak tersedia/)).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/\bHR\b|API/)
    expect(screen.getByRole('button', { name: 'Tambah barang' })).toBeEnabled()
  })

  it('HR down (Admin): the bar names the source', async () => {
    renderApp('/barang', 'admin')
    on('GET /items', page([{ ...kain, responsible: null }], { unavailable: ['hr'] }))
    await rowOf('Kain katun')
    expect(screen.getByText(/API sumber/)).toHaveTextContent('API sumber HR tidak tersedia')
  })

  it('Gudang down (User): plain error, add button disabled, no source name', async () => {
    renderApp('/barang', 'user')
    on('GET /items', fail(502, 'SOURCE_UNREACHABLE', 'Data sedang tidak dapat diambil.'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Layanan sedang bermasalah')
    expect(screen.getByRole('button', { name: 'Tambah barang' })).toBeDisabled()
    expect(document.body).not.toHaveTextContent(/Gudang|SOURCE_|HTTP/)
  })

  it('adds an item and sends only the form fields', async () => {
    renderApp('/barang', 'user')
    on('POST /items', (c) =>
      ok({ ...kain, id: 'i-linen', name: 'Kain linen', ...(c.body as object) }, 201),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah barang' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tambah barang' })
    await userEvent.type(within(dialog).getByLabelText(/^Nama/), 'Kain linen')
    await userEvent.type(within(dialog).getByLabelText(/^Jenis/), 'kain')
    await within(dialog).findByRole('option', { name: 'Joko Susilo · Staf Gudang' })
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Penanggung jawab'),
      'Joko Susilo · Staf Gudang',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByText('Kain linen disimpan')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toMatchObject({
      method: 'POST',
      url: '/items',
      body: { name: 'Kain linen', kind: 'kain', responsible_id: joko.id },
    })
  })

  it('validation errors from the hub appear under their fields', async () => {
    renderApp('/barang', 'user')
    on(
      'POST /items',
      fail(422, 'VALIDATION_ERROR', 'Input tidak valid.', {
        fields: { name: ['Nama terlalu pendek.'] },
      }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah barang' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tambah barang' })
    await userEvent.type(within(dialog).getByLabelText(/^Nama/), 'Ka')
    await userEvent.type(within(dialog).getByLabelText(/^Jenis/), 'kain')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText('Nama terlalu pendek.')).toBeInTheDocument()
  })

  it('REFERENCE_NOT_FOUND: the plain sentence under the person picker', async () => {
    renderApp('/barang', 'user')
    on(
      'PATCH /items/*',
      fail(422, 'REFERENCE_NOT_FOUND', 'x', {
        fields: { responsible_id: ['Personel yang dipilih tidak ditemukan atau sudah nonaktif.'] },
      }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Kain katun' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah Kain katun' })
    await within(dialog).findByRole('option', { name: 'Hendra Gunawan · Supervisor Distribusi' })
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Penanggung jawab'),
      'Hendra Gunawan · Supervisor Distribusi',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(
      await within(dialog).findByText('Personel yang dipilih tidak ditemukan atau sudah nonaktif.'),
    ).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent(/REFERENCE_NOT_FOUND/)
    expect(writes()[0]).toMatchObject({
      method: 'PATCH',
      url: `/items/${kain.id}`,
      body: { responsible_id: hendra.id, expected_version: 1 },
    })
  })

  it('VERSION_CONFLICT opens the reload dialog', async () => {
    renderApp('/barang', 'user')
    on('PATCH /items/*', fail(409, 'VERSION_CONFLICT', 'x', { current_version: 2 }))
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Kain katun' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah Kain katun' })
    const qty = within(dialog).getByLabelText(/^Jumlah/)
    await userEvent.clear(qty)
    await userEvent.type(qty, '10')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(
      await screen.findByText('Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeInTheDocument()
  })

  it('drawer links to Lacak Barang', async () => {
    renderApp('/barang', 'user')
    await userEvent.click(await rowOf('Kain katun'))
    const drawer = await screen.findByRole('dialog', { name: 'Kain katun' })
    expect(within(drawer).getByRole('link', { name: 'Lacak' })).toHaveAttribute(
      'href',
      `/lacak/${kain.id}`,
    )
  })

  it('User has no delete permission: no Nonaktifkan button', async () => {
    renderApp('/barang', 'user')
    await rowOf('Kain katun')
    expect(screen.queryByRole('button', { name: /^Nonaktifkan/ })).not.toBeInTheDocument()
  })
})

describe('Produksi', () => {
  it('lists productions; one without a courier shows "—"', async () => {
    renderApp('/produksi', 'user')
    expect(await rowOf('Area Tekstil A · Tenun')).toHaveTextContent('Dedi Kurniawan')
    expect(await rowOf('Area Tekstil A · Pewarnaan')).toHaveTextContent('—')
  })

  it('Admin: REFERENCED lists what still uses it', async () => {
    renderApp('/produksi', 'admin')
    on(
      'DELETE /productions/*',
      fail(
        409,
        'REFERENCED',
        'Data ini masih dipakai oleh data lain, jadi belum bisa dinonaktifkan.',
        {
          used_by: [{ source: 'gudang', type: 'item', id: kain.id, name: 'Kain katun' }],
        },
      ),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: `Nonaktifkan Area Tekstil A · Tenun` }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nonaktifkan' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('masih dipakai oleh data lain')
    expect(alert).toHaveTextContent('Kain katun')
    expect(alert).toHaveTextContent('Barang · Gudang')
    expect(writes()[0]!.url).toBe(`/productions/${tenun.id}`)
    expect(writes()[0]!.params.get('expected_version')).toBe('1')
  })

  it('Produksi down (Admin): the error names the code, add is disabled', async () => {
    renderApp('/produksi', 'admin')
    on(
      'GET /productions',
      fail(502, 'SOURCE_UNREACHABLE', 'Produksi tidak dapat dihubungi.', { source: 'produksi' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('SOURCE_UNREACHABLE')
    expect(screen.getByRole('button', { name: 'Tambah produksi' })).toBeDisabled()
  })
})

describe('Personel', () => {
  it('User can view but not add', async () => {
    renderApp('/personel', 'user')
    await rowOf('Dedi Kurniawan')
    expect(screen.queryByRole('button', { name: 'Tambah personel' })).not.toBeInTheDocument()
  })

  it('Admin deactivates an unused person', async () => {
    renderApp('/personel', 'admin')
    on('DELETE /people/*', ok({ ...hendra, status: 'nonaktif', version: 2 }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nonaktifkan Hendra Gunawan' }))
    const dialog = await screen.findByRole('dialog')
    on('GET /people', page([joko]))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nonaktifkan' }))
    expect(await screen.findByText('Hendra Gunawan dinonaktifkan')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: 'Detail Hendra Gunawan' })).not.toBeInTheDocument(),
    )
  })
})

describe('User home', () => {
  it('big actions and latest items', async () => {
    renderApp('/', 'user')
    expect(await screen.findByRole('link', { name: 'Tambah barang' })).toHaveAttribute(
      'href',
      '/barang?baru=1',
    )
    const main = screen.getByRole('main')
    expect(within(main).getByRole('link', { name: 'Lacak barang' })).toHaveAttribute(
      'href',
      '/lacak',
    )
    expect(await within(main).findByText('Kardus kemasan besar')).toBeInTheDocument()
  })
})
