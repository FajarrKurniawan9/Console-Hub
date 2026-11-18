import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../../mocks/node'
import { setScenario } from '../../../mocks/scenarios'
import { renderApp } from '../../test/utils'

// Every request path the app makes, to prove the User never calls /admin/* (criterion 6).
let paths: string[] = []
const record = ({ request }: { request: Request }) => void paths.push(new URL(request.url).pathname)
beforeEach(() => {
  paths = []
  server.events.on('request:start', record)
})
afterEach(() => server.events.removeListener('request:start', record))

// A failed write keeps its form open (modal, the page behind is aria-hidden). Close it the way
// a user would, then read the panel above the list.
async function closeDialog() {
  const dialog = screen.queryByRole('dialog')
  if (!dialog) return
  await userEvent.click(
    within(dialog).getAllByRole('button', { name: /^(Batal|Tutup panel|Tutup)$/ })[0]!,
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}
const trail = async () => {
  await closeDialog()
  return screen.findByRole('region', { name: 'Jejak 3 console' })
}
const userTrail = async () => {
  await closeDialog()
  return screen.findByRole('region', { name: 'Status penyimpanan' })
}
const rows = (panel: HTMLElement) =>
  within(panel)
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.textContent ?? '')

async function editEmployeePosition(as: 'admin' | 'user', name: string, position: string) {
  renderApp('/karyawan', as)
  await userEvent.click(await screen.findByRole('button', { name: `Ubah ${name}` }))
  const dialog = await screen.findByRole('dialog')
  const field = within(dialog).getByLabelText('Jabatan')
  await userEvent.clear(field)
  await userEvent.type(field, position)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
  return dialog
}

async function editItemMinStock(as: 'admin' | 'user', name: string, min: string) {
  renderApp('/barang', as)
  await userEvent.click(await screen.findByRole('button', { name: `Ubah ${name}` }))
  const dialog = await screen.findByRole('dialog')
  const field = within(dialog).getByLabelText(/Stok minimum/)
  await userEvent.clear(field)
  await userEvent.type(field, min)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
  return dialog
}

async function orderTooMuch(as: 'admin' | 'user') {
  renderApp('/pesanan', as)
  await userEvent.click(await screen.findByRole('button', { name: 'Buat pesanan' }))
  const dialog = await screen.findByRole('dialog', { name: 'Buat pesanan' })
  await userEvent.type(within(dialog).getByLabelText(/Pelanggan/), 'CV Sumber Rezeki')
  await within(dialog).findByRole('option', { name: 'Dewi Lestari' })
  await userEvent.selectOptions(within(dialog).getByLabelText(/Penanggung jawab/), 'Dewi Lestari')
  const item = within(dialog).getByLabelText('Barang baris 1')
  const opt = await within(dialog).findByRole('option', { name: /Roti tawar kupas/ })
  await userEvent.selectOptions(item, opt)
  await userEvent.type(within(dialog).getByLabelText('Jumlah baris 1'), '500')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Buat pesanan' }))
  return dialog
}

describe('Admin trail', () => {
  it('1. ok: saving Karyawan touches HR, Gudang, Produksi, all Tersimpan', async () => {
    await editEmployeePosition('admin', 'Ratna Kusuma', 'Kepala shift malam')
    const panel = await trail()
    await within(panel).findByText('Mengenai 3 dari 3 console')
    expect(rows(panel)).toEqual([
      expect.stringMatching(/^HR.*Tersimpan.*v\d+/),
      expect.stringMatching(/^Gudang.*Tersimpan.*v\d+/),
      expect.stringMatching(/^Produksi.*Tersimpan.*v\d+/),
    ])
    expect(within(panel).getByRole('link', { name: /Lihat transaksi tx_/ })).toBeInTheDocument()
    expect(panel).toHaveAttribute('aria-live', 'polite')
  })

  it('ok: Divisi writes also show three participants', async () => {
    renderApp('/divisi', 'admin')
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Keuangan' }))
    const dialog = await screen.findByRole('dialog')
    const nama = within(dialog).getByLabelText(/Nama/)
    await userEvent.clear(nama)
    await userEvent.type(nama, 'Keuangan & Pajak')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    const panel = await trail()
    await within(panel).findByText('Mengenai 3 dari 3 console')
    expect(rows(panel)).toHaveLength(3)
  })

  it('3. gudang-down: Gudang "Tidak merespons", the other two "Dibatalkan"', async () => {
    setScenario('gudang-down')
    await editEmployeePosition('admin', 'Ratna Kusuma', 'Kepala shift malam')
    const panel = await trail()
    await within(panel).findByText('Dibatalkan: Gudang tidak merespons')
    expect(rows(panel)).toEqual([
      expect.stringMatching(/^HR.*Dibatalkan/),
      expect.stringMatching(/^Gudang.*Tidak merespons/),
      expect.stringMatching(/^Produksi.*Dibatalkan/),
    ])
  })

  it('5. short stock: Gudang "Ditolak" with INSUFFICIENT_STOCK, HR and Produksi "Dibatalkan"', async () => {
    await orderTooMuch('admin')
    const panel = await trail()
    await within(panel).findByText('Dibatalkan: Gudang menolak (INSUFFICIENT_STOCK)')
    expect(rows(panel)).toEqual([
      expect.stringMatching(/^HR.*Dibatalkan/),
      expect.stringMatching(/^Gudang.*Ditolak.*INSUFFICIENT_STOCK.*tersedia 120, dibutuhkan 500/),
      expect.stringMatching(/^Produksi.*Dibatalkan/),
    ])
  })

  it('4. commit-stuck: "Menyelesaikan…" first, then the final state without reloading', async () => {
    setScenario('commit-stuck')
    await editEmployeePosition('admin', 'Teguh Wibowo', 'Kepala pengemasan')
    const panel = await trail()
    expect((await within(panel).findAllByText(/^Menyelesaikan/)).length).toBeGreaterThan(0)
    await within(panel).findByText(/Perlu tindakan: Produksi/, {}, { timeout: 6000 })
    expect(rows(panel)[2]).toMatch(/^Produksi.*Tidak merespons/)
    expect(paths.filter((p) => p.startsWith('/api/v1/admin/transactions/')).length).toBeGreaterThan(
      1,
    )
  }, 10_000)

  it('slow: Gudang answers much later than the others, still saved', async () => {
    setScenario('slow')
    await editItemMinStock('admin', 'Gula pasir 50 kg', '35')
    const panel = await trail()
    await within(panel).findByText('Mengenai 3 dari 3 console', {}, { timeout: 15_000 })
    const ms = (row: string) => {
      const m = /([\d,]+) (ms|dtk)/.exec(row)!
      return m[2] === 'dtk' ? parseFloat(m[1]!.replace(',', '.')) * 1000 : Number(m[1])
    }
    const [hr, gudang] = rows(panel)
    expect(ms(gudang!)).toBeGreaterThan(ms(hr!) + 500)
  }, 20_000)

  it('the panel stays until closed by hand, and closes with the keyboard', async () => {
    await editEmployeePosition('admin', 'Ratna Kusuma', 'Kepala shift malam')
    const panel = await trail()
    const close = within(panel).getByRole('button', { name: 'Tutup jejak 3 console' })
    close.focus()
    await userEvent.keyboard('{Enter}')
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Jejak 3 console' })).not.toBeInTheDocument(),
    )
  })

  it('read-only on the Transaksi detail page', async () => {
    renderApp('/transaksi/tx_0001', 'admin')
    const panel = await trail()
    expect(rows(panel)).toHaveLength(3)
    expect(within(panel).queryByRole('button', { name: /Tutup/ })).not.toBeInTheDocument()
  })
})

describe('User trail', () => {
  it('2. saving Barang: one sentence, nothing technical, no /admin calls', async () => {
    await editItemMinStock('user', 'Gula pasir 50 kg', '35')
    const panel = await userTrail()
    expect(await within(panel).findByText('Tersimpan di semua sistem.')).toBeInTheDocument()
    expect(panel).not.toHaveTextContent(/HR|Gudang|Produksi|console|tx_|ms|dtk|v\d/)
    expect(paths.some((p) => p.startsWith('/api/v1/admin/'))).toBe(false)
    expect(paths).toContain(paths.find((p) => p.startsWith('/api/v1/transactions/')))
  })

  it('3. gudang-down: friendly failure, says nothing changed, no /admin calls', async () => {
    setScenario('gudang-down')
    await editEmployeePosition('user', 'Ratna Kusuma', 'Kepala shift malam')
    const panel = await userTrail()
    expect(panel).toHaveTextContent('Belum berhasil disimpan. Tidak ada data yang berubah.')
    expect(panel).not.toHaveTextContent(/Gudang|CONSOLE|ECONNREFUSED|tx_/)
    expect(paths.some((p) => p.startsWith('/api/v1/admin/'))).toBe(false)
  })

  it('5. short stock: the business reason, no console or code', async () => {
    await orderTooMuch('user')
    const panel = await userTrail()
    expect(panel).toHaveTextContent('Belum berhasil disimpan')
    expect(panel).toHaveTextContent('tidak cukup (tersedia 120, dibutuhkan 500)')
    expect(panel).not.toHaveTextContent(/Gudang|INSUFFICIENT_STOCK|tx_/)
  })

  it('4. commit-stuck: "Sedang diselesaikan…" then the end, via /transactions/{id} only', async () => {
    setScenario('commit-stuck')
    await editEmployeePosition('user', 'Teguh Wibowo', 'Kepala pengemasan')
    const panel = await userTrail()
    expect(await within(panel).findByText('Sedang diselesaikan…')).toBeInTheDocument()
    await within(panel).findByText(/belum selesai di semua sistem/, {}, { timeout: 6000 })
    expect(paths.some((p) => p.startsWith('/api/v1/admin/'))).toBe(false)
  }, 10_000)
})

describe('"Cek di 3 console"', () => {
  it('7. hidden without admin.consistency.view', async () => {
    const { roles } = await import('../../../mocks/data/users')
    const admin = roles.find((r) => r.code === 'admin_it')!
    admin.permissions = admin.permissions.filter((p) => p !== 'admin.consistency.view')
    renderApp('/barang', 'admin')
    await userEvent.click(await screen.findByRole('row', { name: /Detail Gula pasir/ }))
    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Cek di 3 console' })).not.toBeInTheDocument()
  })

  it('drift: one column differs, with version and a short checksum', async () => {
    setScenario('drift')
    renderApp('/karyawan', 'admin')
    await userEvent.click(await screen.findByRole('row', { name: /Detail Ratna Kusuma/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cek di 3 console' }))
    expect(await within(dialog).findByText('Berbeda di Produksi')).toBeInTheDocument()
    expect(within(dialog).getByText('Isi berbeda')).toBeInTheDocument()
    const sums = within(dialog).getAllByTitle(/^[0-9a-f]{16}$/)
    expect(sums).toHaveLength(3)
    expect(sums.every((s) => s.textContent?.length === 8)).toBe(true)
    expect(within(dialog).getByRole('link', { name: /halaman Konsistensi/ })).toBeInTheDocument()
  })

  it('in sync: "Sama di 3 console"', async () => {
    renderApp('/divisi', 'admin')
    await userEvent.click(await screen.findByRole('row', { name: /Detail divisi HRD/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cek di 3 console' }))
    expect(await screen.findByText('Sama di 3 console')).toBeInTheDocument()
  })
})
