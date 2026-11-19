// Fase 3: setiap layar menampilkan memuat, kosong, dan galat (dengan coba lagi).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/utils'
import { setScenario } from '../scenarios'

const LISTS = [
  { path: '/barang', label: 'Memuat barang', empty: 'Belum ada barang dari Console Hub.', row: 'SKU-BB-001' },
  { path: '/reservasi', label: 'Memuat reservasi', empty: 'Belum ada reservasi.', row: 'PO-2026-0008' },
  { path: '/akses-area', label: 'Memuat akses area', empty: 'Belum ada akses area.', row: 'Siti Rahmawati' },
  { path: '/log', label: 'Memuat log', empty: 'Belum ada catatan log.', row: /Sinkronisasi|Reservasi|Stok/ },
] as const

describe.each(LISTS)('$path', ({ path, label, empty, row }) => {
  it('memuat lalu menampilkan data', async () => {
    renderApp(path)
    expect(await screen.findByRole('status', { name: label })).toBeInTheDocument()
    expect((await screen.findAllByText(row))[0]).toBeInTheDocument()
  })

  it('kosong', async () => {
    setScenario('empty')
    renderApp(path)
    expect(await screen.findByText(empty)).toBeInTheDocument()
  })

  it('galat dengan tombol coba lagi yang memulihkan', async () => {
    setScenario('server-error')
    renderApp(path)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Server gudang sedang bermasalah')
    setScenario('ok')
    await userEvent.click(within(alert).getByRole('button', { name: 'Coba lagi' }))
    expect((await screen.findAllByText(row))[0]).toBeInTheDocument()
  })
})

describe('Beranda', () => {
  it('angka ringkas, stok menipis, dan pergerakan terakhir', async () => {
    renderApp('/')
    expect(await screen.findByRole('button', { name: /Barang: 15/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Stok menipis: 4/ })).toBeInTheDocument()
    expect(screen.getByText('Pigmen hitam masterbatch')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pergerakan stok terakhir' })).toBeInTheDocument()
  })

  it('kosong', async () => {
    setScenario('empty')
    renderApp('/')
    expect(await screen.findByText('Tidak ada barang dengan stok di bawah minimum.')).toBeInTheDocument()
    expect(screen.getByText('Belum ada pergerakan stok.')).toBeInTheDocument()
  })

  it('galat', async () => {
    setScenario('server-error')
    renderApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('Coba lagi')
  })
})

describe('Barang', () => {
  it('baca saja: label Console Hub, tanpa kontrol tulis', async () => {
    renderApp('/barang')
    await screen.findByText('SKU-BB-001')
    expect(
      screen.getByText('Data barang dikelola dari Console Hub dan tidak dapat diubah di sini.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tambah|ubah|hapus/i })).toBeNull()
  })

  it('status stok dan penanda Ditahan', async () => {
    renderApp('/barang')
    const locked = (await screen.findByText('SKU-BJ-003')).closest('tr')!
    expect(within(locked).getByText('Ditahan')).toBeInTheDocument()
    expect(within(screen.getByText('SKU-BJ-001').closest('tr')!).getByText('Habis')).toBeInTheDocument()
    expect(within(screen.getByText('SKU-BB-002').closest('tr')!).getByText('Menipis')).toBeInTheDocument()
  })

  it('filter stok habis', async () => {
    renderApp('/barang?stock=out')
    await screen.findByText('SKU-BJ-001')
    expect(screen.queryByText('SKU-BB-001')).toBeNull()
  })

  it('klik baris (atau Enter) membuka drawer detail dengan stok per rak', async () => {
    renderApp('/barang')
    const row = (await screen.findByText('SKU-BB-001')).closest('tr')!
    row.focus()
    await userEvent.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Detail barang' })
    expect(await within(dialog).findByText('Biji plastik PP')).toBeInTheDocument()
    expect(within(dialog).getByText('Rak bahan baku A1')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Pergerakan terakhir' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getAllByText('Saldo awal').length).toBeGreaterThan(0))
  })
})

describe('Sesi', () => {
  it('skenario unauthenticated mengembalikan ke login', async () => {
    setScenario('unauthenticated')
    renderApp('/barang')
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })
})
