import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ok, on } from '../../test/api'
import { renderApp } from '../../test/utils'

const mockSummary = {
  total_items: 24,
  total_quantity: 450,
  transactions_count: 18,
  activity_trend: [
    { date: '2026-11-20', created: 3, updated: 1, deactivated: 0 },
    { date: '2026-11-21', created: 2, updated: 4, deactivated: 1 },
    { date: '2026-11-22', created: 5, updated: 2, deactivated: 0 },
  ],
  kind_distribution: [
    { kind: 'kain', count: 12, total_quantity: 300 },
    { kind: 'besi', count: 8, total_quantity: 120 },
    { kind: 'kayu', count: 4, total_quantity: 30 },
  ],
}

describe('Dashboard Transaksi', () => {
  it('renders KPI metrics and charts for permitted users', async () => {
    on('GET /dashboard/items', ok(mockSummary))

    renderApp('/dashboard', 'admin')

    expect(await screen.findByRole('heading', { name: 'Dashboard transaksi' })).toBeInTheDocument()
    expect(await screen.findByText('24')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()

    // Trend section
    expect(screen.getByText('Tren Aktivitas Barang (Harian)')).toBeInTheDocument()

    // Kind distribution section
    expect(screen.getByText('Distribusi Stok Berdasarkan Jenis Barang')).toBeInTheDocument()
    // Recharts renders chart via SVG; verify the section container is present
    expect(screen.getByText('Distribusi Stok Berdasarkan Jenis Barang').closest('section, div')).toBeTruthy()
  })

  it('allows toggling date range between 7, 14 and 30 days', async () => {
    on('GET /dashboard/items', ok(mockSummary))

    renderApp('/dashboard', 'admin')

    const btn14 = await screen.findByRole('button', { name: '14 Hari' })
    expect(btn14).toBeInTheDocument()

    await userEvent.click(btn14)
    expect(btn14).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows empty message when there is no activity or item data', async () => {
    on(
      'GET /dashboard/items',
      ok({
        total_items: 0,
        total_quantity: 0,
        transactions_count: 0,
        activity_trend: [],
        kind_distribution: [],
      }),
    )

    renderApp('/dashboard', 'admin')

    expect(await screen.findByText('Belum ada riwayat aktivitas.')).toBeInTheDocument()
    expect(screen.getByText('Belum ada data barang.')).toBeInTheDocument()
  })
})
