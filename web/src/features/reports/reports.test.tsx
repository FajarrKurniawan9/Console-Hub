import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReportExport } from '../../lib/api/schemas'
import { calls, fail, ok, on } from '../../test/api'
import { ExportModal } from './ExportModal'
import { ExportWaitingListModal } from './ExportWaitingListModal'
import { canAccessExportQueue, canExportType, downloadExportFile, normalizeDownloadUrl } from './queries'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('RBAC export permission helpers', () => {
  it('matches backend permissions per export type', () => {
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
    expect(canAccessExportQueue(admin)).toBe(true)

    const auditor = {
      id: 6,
      name: 'Auditor',
      email: 'auditor@example.com',
      role: { code: 'auditor', name: 'Auditor' },
      permissions: ['admin.audit.view', 'barang.view'],
    }
    expect(canExportType(auditor, 'audit')).toBe(true)
    expect(canExportType(auditor, 'logs')).toBe(false)
    expect(canExportType(auditor, 'barang')).toBe(true)
    expect(canAccessExportQueue(auditor)).toBe(true)

    const manajer = {
      id: 3,
      name: 'Manajer',
      email: 'manajer@example.com',
      role: { code: 'manajer_gudang', name: 'Manajer Gudang' },
      permissions: ['barang.view', 'barang.create'],
    }
    expect(canExportType(manajer, 'barang')).toBe(true)
    expect(canExportType(manajer, 'audit')).toBe(false)
    expect(canExportType(manajer, 'logs')).toBe(false)
    expect(canAccessExportQueue(manajer)).toBe(true)

    const hrOnly = {
      id: 5,
      name: 'Staff HR',
      email: 'hr@example.com',
      role: { code: 'staff_hr', name: 'Staff HR' },
      permissions: ['personel.view'],
    }
    expect(canExportType(hrOnly, 'barang')).toBe(false)
    expect(canAccessExportQueue(hrOnly)).toBe(false)
  })
})

describe('normalizeDownloadUrl', () => {
  it('avoids duplicating baseURL prefix and defaults to relative path', () => {
    const base: ReportExport = {
      id: 102,
      type: 'barang',
      name: 'Laporan Stok',
      status: 'completed',
      format: 'csv',
      download_url: '/reports/exports/102/download',
      created_at: '2026-11-25T10:00:00Z',
    }
    expect(normalizeDownloadUrl(base)).toBe('/reports/exports/102/download')
    expect(normalizeDownloadUrl({ ...base, download_url: '/api/v1/reports/exports/102/download' })).toBe(
      '/reports/exports/102/download',
    )
    expect(normalizeDownloadUrl({ ...base, download_url: null })).toBe('/reports/exports/102/download')
  })
})

describe('ExportWaitingListModal', () => {
  const sampleItems: ReportExport[] = [
    {
      id: 100,
      type: 'barang',
      name: 'Laporan Barang (XLSX)',
      status: 'processing',
      format: 'xlsx',
      file_url: null,
      download_url: null,
      requester_name: 'Hendra Wijaya',
      requester_role: 'manajer_gudang',
      is_mine: false,
      queue_position: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: 101,
      type: 'audit',
      name: 'Laporan Audit Harian',
      status: 'pending',
      format: 'csv',
      file_url: null,
      download_url: null,
      requester_name: 'Rina Wulandari',
      requester_role: 'admin_it',
      is_mine: true,
      queue_position: 2,
      created_at: new Date().toISOString(),
    },
    {
      id: 102,
      type: 'barang',
      name: 'Laporan Stok Barang',
      status: 'completed',
      format: 'csv',
      file_url: null,
      download_url: '/reports/exports/102/download',
      row_count: 42,
      requester_name: 'Rina Wulandari',
      requester_role: 'admin_it',
      is_mine: true,
      queue_position: null,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
  ]

  it('displays shared active waiting list with queue positions and download button only for own completed export', async () => {
    on('GET /reports/exports', ok(sampleItems))

    wrap(<ExportWaitingListModal open={true} onOpenChange={vi.fn()} />)

    expect(await screen.findByText('Laporan Barang (XLSX)')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText(/Hendra Wijaya/)).toBeInTheDocument()
    expect(screen.getByText('Antrean pengguna lain')).toBeInTheDocument()

    expect(screen.getByText('Laporan Audit Harian')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('Waiting List')).toBeInTheDocument()

    expect(screen.getByText('Laporan Stok Barang')).toBeInTheDocument()
    expect(screen.getByText(/42 baris/)).toBeInTheDocument()
    expect(screen.getByText('Siap Diunduh')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Unduh/i })).toHaveLength(1)
  })

  it('shows an error alert instead of falling back to localStorage when backend fails', async () => {
    localStorage.setItem('ch.mock_reports_exports', JSON.stringify(sampleItems))
    on('GET /reports/exports', fail(500, 'SERVER_ERROR', 'Server gagal'))

    wrap(<ExportWaitingListModal open={true} onOpenChange={vi.fn()} />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Laporan Stok Barang')).not.toBeInTheDocument()
    localStorage.removeItem('ch.mock_reports_exports')
  })
})

describe('downloadExportFile', () => {
  it('rejects on backend failure instead of generating dummy client-side CSV', async () => {
    on('GET /reports/exports/102/download', fail(404, 'NOT_FOUND', 'File kedaluwarsa'))

    await expect(
      downloadExportFile({
        id: 102,
        type: 'barang',
        name: 'Laporan Stok Barang',
        status: 'completed',
        format: 'csv',
        download_url: '/reports/exports/102/download',
        created_at: new Date().toISOString(),
      }),
    ).rejects.toThrow()
  })
})

describe('ExportModal', () => {
  it('creates an export ticket on backend submit', async () => {
    on(
      'POST /reports/export',
      ok(
        {
          id: 201,
          type: 'barang',
          name: 'Laporan Barang (CSV)',
          status: 'pending',
          format: 'csv',
          is_mine: true,
          queue_position: 1,
          created_at: new Date().toISOString(),
        },
        202,
      ),
    )

    const onSuccess = vi.fn()
    const onOpenChange = vi.fn()

    wrap(
      <ExportModal
        open={true}
        onOpenChange={onOpenChange}
        type="barang"
        title="Barang"
        filters={{ kind: 'kain' }}
        onSuccess={onSuccess}
      />,
    )

    expect(screen.getByText('Export Data Barang')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Mulai Antrean Export/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    const post = calls.find((c) => c.method === 'POST' && c.url === '/reports/export')
    expect(post?.body).toMatchObject({ type: 'barang', format: 'csv', filters: { kind: 'kain' } })
  })

  it('does not succeed or fall back to localStorage when backend rejects the request', async () => {
    on('POST /reports/export', fail(403, 'FORBIDDEN', 'Akses ditolak.'))
    const onSuccess = vi.fn()
    const onOpenChange = vi.fn()

    wrap(
      <ExportModal
        open={true}
        onOpenChange={onOpenChange}
        type="audit"
        title="Audit"
        onSuccess={onSuccess}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Mulai Antrean Export/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url === '/reports/export')).toBe(true)
    })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
