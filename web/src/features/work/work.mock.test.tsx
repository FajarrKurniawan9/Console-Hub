import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { work } from '../../../mocks/data/work'
import { setScenario } from '../../../mocks/scenarios'
import { renderApp } from '../../test/utils'

async function openOrderForm(as: 'admin' | 'user') {
  renderApp('/pesanan', as)
  await userEvent.click(await screen.findByRole('button', { name: 'Buat pesanan' }))
  return screen.findByRole('dialog', { name: 'Buat pesanan' })
}

async function fillOrder(dialog: HTMLElement, opts: { pic: string; item: RegExp; qty: string }) {
  await userEvent.type(within(dialog).getByLabelText(/Pelanggan/), 'CV Sumber Rezeki')
  const pic = within(dialog).getByLabelText(/Penanggung jawab/)
  await within(dialog).findByRole('option', { name: opts.pic })
  await userEvent.selectOptions(pic, opts.pic)
  const item = within(dialog).getByLabelText('Barang baris 1')
  await within(dialog).findByRole('option', { name: opts.item })
  await userEvent.selectOptions(item, within(dialog).getByRole('option', { name: opts.item }))
  await userEvent.type(within(dialog).getByLabelText('Jumlah baris 1'), opts.qty)
}

describe('Pesanan', () => {
  it('creates an order, reserves stock, and shows it in the list', async () => {
    const dialog = await openOrderForm('user')
    await fillOrder(dialog, { pic: 'Dewi Lestari', item: /Roti tawar kupas/, qty: '10' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat pesanan' }))
    expect(await screen.findByText('Pesanan dibuat')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(work.items.find((i) => i.sku === 'SKU-BJ-001')!.stok_tersedia).toBe(110)
    expect(await screen.findAllByText(/Roti tawar kupas 400 g × 10/)).not.toHaveLength(0)
  })

  it('User sees only the business reason when stock is short', async () => {
    const dialog = await openOrderForm('user')
    await fillOrder(dialog, { pic: 'Dewi Lestari', item: /Roti tawar kupas/, qty: '500' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat pesanan' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(
      'stok Roti tawar kupas 400 g tidak cukup (tersedia 120, dibutuhkan 500)',
    )
    expect(alert).toHaveTextContent('Tidak ada data yang berubah')
    expect(alert).not.toHaveTextContent(/Gudang|INSUFFICIENT_STOCK|tx_/)
    expect(work.items.find((i) => i.sku === 'SKU-BJ-001')!.stok_tersedia).toBe(120)
  })

  it('Admin IT also sees the refusal per console with its code', async () => {
    const dialog = await openOrderForm('admin')
    await fillOrder(dialog, { pic: 'Hendra Gunawan', item: /Roti tawar kupas/, qty: '500' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat pesanan' }))
    const alert = await within(dialog).findByRole('alert')
    await userEvent.click(within(alert).getByText(/Alasan per console \(2\)/))
    expect(alert).toHaveTextContent('INSUFFICIENT_STOCK')
    expect(alert).toHaveTextContent('PIC_OVERLOADED')
    expect(within(alert).getByRole('link', { name: /^tx_/ })).toBeInTheDocument()
  })

  it('completes an open order after confirmation', async () => {
    renderApp('/pesanan?status=ANTRE', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Selesaikan PO-2026-0006' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Selesaikan' }))
    expect(await screen.findByText('PO-2026-0006 diselesaikan')).toBeInTheDocument()
    expect(work.orders.find((o) => o.order_no === 'PO-2026-0006')!.status).toBe('SELESAI')
  })

  it('a stale version opens the reload dialog', async () => {
    renderApp('/pesanan?status=ANTRE', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Batalkan PO-2026-0006' }))
    work.orders.find((o) => o.order_no === 'PO-2026-0006')!.version += 1 // someone else edited it
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Batalkan' }))
    expect(
      await screen.findByText(/baru saja diubah orang lain atau sedang diproses/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Muat ulang' })).toBeInTheDocument()
  })

  it('hides the create button without pesanan.create', async () => {
    renderApp('/pesanan', 'user-no-create')
    expect(await screen.findAllByRole('button', { name: /Selesaikan PO-/ })).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Buat pesanan' })).not.toBeInTheDocument()
  })
})

describe('Karyawan', () => {
  it('Admin edits a position; version goes up', async () => {
    renderApp('/karyawan', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Ratna Kusuma' }))
    const dialog = await screen.findByRole('dialog')
    const pos = within(dialog).getByLabelText('Jabatan')
    await userEvent.clear(pos)
    await userEvent.type(pos, 'Kepala shift malam')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByText('Data Ratna Kusuma disimpan')).toBeInTheDocument()
    const e = work.employees.find((x) => x.name === 'Ratna Kusuma')!
    expect(e.position).toBe('Kepala shift malam')
    expect(e.version).toBe(1 + (8 % 3) + 1)
  })

  it('refuses to deactivate someone holding open orders', async () => {
    renderApp('/karyawan', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Nonaktifkan Hendra Gunawan' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nonaktifkan' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'masih memegang 5 pesanan yang belum selesai',
    )
  })

  it('shows 422 field errors under the field', async () => {
    setScenario('validation-error')
    renderApp('/karyawan', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah karyawan' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Nama/), 'Wahyu Hidayat')
    await within(dialog).findByRole('option', { name: 'Produksi' })
    await userEvent.selectOptions(within(dialog).getByLabelText(/Divisi/), 'Produksi')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText(/skenario validation-error/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Nama/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('User without karyawan.delete sees no Nonaktifkan button', async () => {
    renderApp('/karyawan', 'user')
    await screen.findByRole('button', { name: 'Ubah Ratna Kusuma' })
    expect(screen.queryByRole('button', { name: /Nonaktifkan/ })).not.toBeInTheDocument()
  })
})

describe('Barang', () => {
  it('dims inactive items and shows stock against the minimum', async () => {
    renderApp('/barang', 'admin')
    const row = (await screen.findByText('Plastik kemasan 1 kg')).closest('tr')!
    expect(row).toHaveClass('opacity-60')
    const sugar = screen.getByText('Gula pasir 50 kg').closest('tr')!
    expect(sugar).toHaveTextContent('di bawah minimum')
  })

  it('Gudang down: the list fails with a plain message for User', async () => {
    setScenario('gudang-down')
    renderApp('/barang', 'user')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Layanan sedang bermasalah')
    expect(alert).not.toHaveTextContent(/Gudang|CONSOLE|ECONNREFUSED/)
  })

  it('Gudang down: a write is refused with nothing changed', async () => {
    setScenario('gudang-down')
    renderApp('/divisi', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Keuangan' }))
    const dialog = await screen.findByRole('dialog')
    const nama = within(dialog).getByLabelText(/Nama/)
    await userEvent.clear(nama)
    await userEvent.type(nama, 'Keuangan & Pajak')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('Console tidak dapat dihubungi')
    expect(alert).toHaveTextContent('Console Gudang tidak dapat dihubungi')
    expect(work.divisions.find((d) => d.kode === 'KEU')!.nama).toBe('Keuangan')
  })
})

describe('202 commit', () => {
  it('closes the form and follows the 202 in the panel until the end', async () => {
    setScenario('commit-stuck')
    renderApp('/karyawan', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Teguh Wibowo' }))
    const dialog = await screen.findByRole('dialog')
    const pos = within(dialog).getByLabelText('Jabatan')
    await userEvent.clear(pos)
    await userEvent.type(pos, 'Kepala pengemasan')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByText(/sedang diselesaikan/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const panel = await screen.findByRole('region', { name: 'Status penyimpanan' })
    // Polls every 2 s until the stuck commit becomes needs_attention.
    await within(panel).findByText(/Admin IT sudah diberi tahu/, {}, { timeout: 6000 })
    expect(panel).not.toHaveTextContent(/tx_|Produksi/)
  }, 10_000)
})

describe('Beranda User', () => {
  it('shows the main action and open orders, nothing technical', async () => {
    renderApp('/', 'user')
    expect(await screen.findByRole('button', { name: 'Buat pesanan' })).toBeInTheDocument()
    const section = screen
      .getByRole('heading', { name: 'Pesanan yang masih antre' })
      .closest('section')!
    expect(await within(section).findAllByText(/PO-2026-000[1-6]/)).toHaveLength(6)
    const m = (document.body.textContent ?? '').match(/.{30}(Versi|version|tx_|console).{30}/i)
    expect(m?.[0] ?? null).toBeNull()
  })

  it('empty scenario gives a specific sentence', async () => {
    setScenario('empty')
    renderApp('/', 'user')
    expect(await screen.findByText(/Tidak ada pesanan yang antre/)).toBeInTheDocument()
  })
})
