import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { personId, store } from '../../../mocks/data/logistics'
import { setScenario } from '../../../mocks/scenarios'
import { renderApp } from '../../test/utils'

const rowOf = (name: string) => screen.findByRole('row', { name: `Detail ${name}` })

describe('Barang', () => {
  it('lists items with merged origin and responsible', async () => {
    renderApp('/barang', 'user')
    const row = await rowOf('Kain katun')
    expect(row).toHaveTextContent('Area Tekstil A · Tenun')
    expect(row).toHaveTextContent('Joko Susilo')
    expect(row).toHaveTextContent('340 m')
    // Inactive items are hidden by default.
    expect(screen.queryByRole('row', { name: 'Detail Mur baut M10' })).not.toBeInTheDocument()
  })

  it('shows a skeleton while loading', async () => {
    renderApp('/barang', 'user')
    expect(await screen.findByRole('status', { name: 'Memuat barang' })).toBeInTheDocument()
    await rowOf('Kain katun')
  })

  it('empty: a specific sentence', async () => {
    setScenario('empty')
    renderApp('/barang', 'user')
    expect(await screen.findByText(/Belum ada barang/)).toBeInTheDocument()
  })

  it('filter with no match offers to clear it', async () => {
    renderApp('/barang?q=zzz', 'user')
    expect(await screen.findByText(/Tidak ada barang yang cocok/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hapus filter' }))
    await rowOf('Kain katun')
  })

  it('hr-down (User): row intact, "Tidak tersedia" in grey, writes still allowed', async () => {
    setScenario('hr-down')
    renderApp('/barang', 'user')
    const row = await rowOf('Kain katun')
    expect(within(row).getByText('Tidak tersedia')).toBeInTheDocument()
    expect(row).toHaveTextContent('Area Tekstil A')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sebagian keterangan sedang tidak tersedia',
    )
    expect(document.body).not.toHaveTextContent(/\bHR\b|API/)
    expect(screen.getByRole('button', { name: 'Tambah barang' })).toBeEnabled()
  })

  it('hr-down (Admin): the bar names the source', async () => {
    setScenario('hr-down')
    renderApp('/barang', 'admin')
    await rowOf('Kain katun')
    expect(screen.getByText(/tidak tersedia\. Kolom gabungan/)).toHaveTextContent(
      'API sumber HR tidak tersedia',
    )
  })

  it('gudang-down (User): plain error, add button disabled', async () => {
    setScenario('gudang-down')
    renderApp('/barang', 'user')
    expect(await screen.findByRole('alert')).toHaveTextContent('Layanan sedang bermasalah')
    expect(
      screen.getByText(/perubahan data sementara tidak dapat disimpan/, { selector: 'span' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tambah barang' })).toBeDisabled()
    expect(document.body).not.toHaveTextContent(/Gudang|SOURCE_|HTTP/)
  })

  it('adds an item with origin and responsible', async () => {
    renderApp('/barang', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah barang' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tambah barang' })
    await userEvent.type(within(dialog).getByLabelText(/^Nama/), 'Kain linen')
    await userEvent.type(within(dialog).getByLabelText(/^Jenis/), 'kain')
    const origin = within(dialog).getByLabelText('Asal produksi')
    await within(dialog).findByRole('option', { name: 'Area Tekstil A · Tenun' })
    await userEvent.selectOptions(origin, 'Area Tekstil A · Tenun')
    const pj = within(dialog).getByLabelText('Penanggung jawab')
    await within(dialog).findByRole('option', { name: 'Joko Susilo · Staf Gudang' })
    await userEvent.selectOptions(pj, 'Joko Susilo · Staf Gudang')
    const qty = within(dialog).getByLabelText(/^Jumlah/)
    await userEvent.clear(qty)
    await userEvent.type(qty, '75')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByText('Kain linen disimpan')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await rowOf('Kain linen')).toHaveTextContent('Joko Susilo')
    expect(store.items.find((i) => i.name === 'Kain linen')!.quantity).toBe(75)
  })

  it('save button is disabled while saving (no double submit)', async () => {
    renderApp('/barang', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah barang' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tambah barang' })
    await userEvent.type(within(dialog).getByLabelText(/^Nama/), 'Kain linen')
    await userEvent.type(within(dialog).getByLabelText(/^Jenis/), 'kain')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(within(dialog).getByRole('button', { name: 'Menyimpan…' })).toBeDisabled()
    await screen.findByText('Kain linen disimpan')
    expect(store.items.filter((i) => i.name === 'Kain linen')).toHaveLength(1)
  })

  it('validation errors appear under their fields', async () => {
    renderApp('/barang', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah barang' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tambah barang' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText('Nama wajib diisi.')).toBeInTheDocument()
    expect(within(dialog).getByText('Jenis wajib diisi.')).toBeInTheDocument()
  })

  it('REFERENCE_NOT_FOUND: the plain sentence under the person picker', async () => {
    renderApp('/barang', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Kain katun' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah Kain katun' })
    const pj = within(dialog).getByLabelText('Penanggung jawab')
    await within(dialog).findByRole('option', { name: 'Fajar Nugroho · Kepala Gudang' })
    await userEvent.selectOptions(pj, 'Fajar Nugroho · Kepala Gudang')
    // Someone deactivates Fajar meanwhile.
    store.people.find((p) => p.id === personId(1))!.status = 'nonaktif'
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(
      await within(dialog).findByText('Personel yang dipilih tidak ditemukan atau sudah nonaktif.'),
    ).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent(/REFERENCE_NOT_FOUND/)
  })

  it('VERSION_CONFLICT opens the reload dialog', async () => {
    setScenario('conflict')
    renderApp('/barang', 'user')
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

  it('drawer shows details and a Lacak button that opens Lacak Barang', async () => {
    renderApp('/barang', 'user')
    await userEvent.click(await rowOf('Kain katun'))
    const drawer = await screen.findByRole('dialog', { name: 'Kain katun' })
    expect(drawer).toHaveTextContent('Joko Susilo · Staf Gudang')
    expect(within(drawer).getByRole('link', { name: 'Lacak' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/lacak\/c3/),
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
    await userEvent.click(
      await screen.findByRole('button', { name: 'Nonaktifkan Area Logam B · Pengecoran' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nonaktifkan' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('masih dipakai oleh data lain')
    expect(alert).toHaveTextContent('Besi beton 10 mm')
    expect(alert).toHaveTextContent('Barang · Gudang')
  })

  it('produksi-down: list fails, Admin sees the source name', async () => {
    setScenario('produksi-down')
    renderApp('/produksi', 'admin')
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
    await userEvent.click(await screen.findByRole('button', { name: 'Nonaktifkan Hendra Gunawan' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nonaktifkan' }))
    expect(await screen.findByText('Hendra Gunawan dinonaktifkan')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: 'Detail Hendra Gunawan' })).not.toBeInTheDocument(),
    )
  })

  it('referenced scenario (User wording via Admin-free copy check)', async () => {
    setScenario('referenced')
    renderApp('/personel', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Nonaktifkan Hendra Gunawan' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nonaktifkan' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Data ini masih dipakai oleh data lain, jadi belum bisa dinonaktifkan.',
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
