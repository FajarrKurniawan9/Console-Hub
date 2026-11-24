import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { canExportType } from './queries'
import { ExportWaitingListModal } from './ExportWaitingListModal'
import { ExportModal } from './ExportModal'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { on, ok } from '../../test/api'
import type { ReportExport } from '../../lib/api/schemas'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('canExportType permission rules', () => {
  it('allows Admin IT to export everything', () => {
    const admin = {
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: { code: 'admin_it', name: 'Admin IT' },
      permissions: ['admin.dashboard.view', 'admin.logs.view', 'admin.audit.view', 'barang.view'],
    }
    expect(canExportType(admin, 'audit')).toBe(true)
    expect(canExportType(admin, 'logs')).toBe(true)
    expect(canExportType(admin, 'barang')).toBe(true)
  })

  it('allows Auditor to export Audit and Logs, but not Barang', () => {
    const auditor = {
      id: 6,
      name: 'Auditor',
      email: 'auditor@example.com',
      role: { code: 'auditor', name: 'Auditor' },
      permissions: ['admin.audit.view', 'admin.logs.view'],
    }
    expect(canExportType(auditor, 'audit')).toBe(true)
    expect(canExportType(auditor, 'logs')).toBe(true)
    expect(canExportType(auditor, 'barang')).toBe(false)
  })

  it('allows Manajer Gudang to export Barang, but not Audit or Logs', () => {
    const manajer = {
      id: 3,
      name: 'Manajer',
      email: 'manajer@example.com',
      role: { code: 'manajer_gudang', name: 'Manajer Gudang' },
      permissions: ['barang.view', 'barang.create', 'barang.update', 'barang.delete'],
    }
    expect(canExportType(manajer, 'barang')).toBe(true)
    expect(canExportType(manajer, 'audit')).toBe(false)
    expect(canExportType(manajer, 'logs')).toBe(false)
  })
})

describe('ExportWaitingListModal', () => {
  const sampleItems: ReportExport[] = [
    {
      id: 101,
      type: 'audit',
      name: 'Laporan Audit Harian',
      status: 'pending',
      format: 'csv',
      file_url: null,
      download_url: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 102,
      type: 'barang',
      name: 'Laporan Stok Barang',
      status: 'completed',
      format: 'csv',
      file_url: null,
      download_url: '/api/v1/reports/exports/102/download',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
  ]

  it('displays waiting list and download button for completed export', async () => {
    on('GET /reports/exports', ok(sampleItems))

    wrap(<ExportWaitingListModal open={true} onOpenChange={vi.fn()} />)

    expect(await screen.findByText('Laporan Audit Harian')).toBeInTheDocument()
    expect(screen.getByText('Waiting List')).toBeInTheDocument()
    expect(screen.getByText('Laporan Stok Barang')).toBeInTheDocument()
    expect(screen.getByText('Siap Diunduh')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unduh CSV/i })).toBeInTheDocument()
  })
})

describe('ExportModal', () => {
  it('creates an export ticket on submit', async () => {
    on('POST /reports/export', ok({
      id: 201,
      type: 'barang',
      name: 'Laporan Barang (CSV)',
      status: 'pending',
      format: 'csv',
      created_at: new Date().toISOString(),
    }))

    const onSuccess = vi.fn()
    const onOpenChange = vi.fn()

    wrap(
      <ExportModal
        open={true}
        onOpenChange={onOpenChange}
        type="barang"
        title="Barang"
        onSuccess={onSuccess}
      />
    )

    expect(screen.getByText('Export Data Barang')).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /Mulai Antrean Export/i })
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
