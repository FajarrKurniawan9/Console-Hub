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

  it('shows Unduh PDF and Unduh DOCX buttons for completed PDF and DOCX exports', async () => {
    on(
      'GET /reports/exports',
      ok([
        {
          id: 201,
          type: 'audit',
          name: 'Laporan Audit (PDF)',
          status: 'completed',
          format: 'pdf',
          download_url: '/reports/exports/201/download',
          row_count: 15,
          is_mine: true,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
        {
          id: 202,
          type: 'barang',
          name: 'Laporan Barang (DOCX)',
          status: 'completed',
          format: 'docx',
          download_url: '/reports/exports/202/download',
          row_count: 8,
          is_mine: true,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      ]),
    )

    wrap(<ExportWaitingListModal open={true} onOpenChange={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /Unduh PDF/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unduh DOCX/i })).toBeInTheDocument()
  })

  it('parses and displays scheduled and cancelled exports without CONTRACT_MISMATCH', async () => {
    on(
      'GET /reports/exports',
      ok([
        {
          id: 301,
          type: 'barang',
          name: 'Stok Harian (XLSX)',
          status: 'scheduled',
          format: 'xlsx',
          schedule_type: 'recurring',
          cron_expression: '0 8 * * *',
          timezone: 'Asia/Jakarta',
          scheduled_at: '2026-11-26T01:00:00Z',
          is_mine: true,
          queue_position: null,
          created_at: new Date().toISOString(),
        },
        {
          id: 302,
          type: 'audit',
          name: 'Audit Batal (PDF)',
          status: 'cancelled',
          format: 'pdf',
          schedule_type: 'once',
          cancelled_at: new Date().toISOString(),
          is_mine: true,
          queue_position: null,
          created_at: new Date().toISOString(),
        },
      ]),
    )

    wrap(<ExportWaitingListModal open={true} onOpenChange={vi.fn()} />)

    expect(await screen.findByText('Stok Harian (XLSX)')).toBeInTheDocument()
    expect(screen.getByText('Terjadwal')).toBeInTheDocument()
    expect(screen.getByText(/0 8 \* \* \*/)).toBeInTheDocument()
    expect(screen.getByText('Audit Batal (PDF)')).toBeInTheDocument()
    expect(screen.getByText('Dibatalkan')).toBeInTheDocument()
    expect(screen.queryByText('Gagal')).not.toBeInTheDocument()
  })

  it('filters by category tabs and cancels own pending/scheduled export via backend API', async () => {
    const items: ReportExport[] = [
      {
        id: 401,
        type: 'barang',
        name: 'Antrean Orang Lain',
        status: 'pending',
        format: 'csv',
        is_mine: false,
        queue_position: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: 402,
        type: 'audit',
        name: 'Audit Terjadwal Besok',
        status: 'scheduled',
        format: 'pdf',
        schedule_type: 'once',
        scheduled_at: '2030-01-15T01:00:00Z',
        is_mine: true,
        queue_position: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 403,
        type: 'logs',
        name: 'Log Selesai',
        status: 'completed',
        format: 'xlsx',
        download_url: '/reports/exports/403/download',
        row_count: 10,
        is_mine: true,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      },
    ]
    on('GET /reports/exports', ok(items))
    on(
      'POST /reports/exports/402/cancel',
      ok({
        ...items[1],
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }),
    )

    wrap(<ExportWaitingListModal open={true} onOpenChange={vi.fn()} />)

    expect(await screen.findByText('Audit Terjadwal Besok')).toBeInTheDocument()
    // Cancel button must only appear for own scheduled/pending export (id 402), not other user's pending (id 401)
    const cancelBtns = screen.getAllByRole('button', { name: /Batalkan/i })
    expect(cancelBtns).toHaveLength(1)
    expect(cancelBtns[0]).toHaveClass('border-error', 'text-error')

    await userEvent.click(screen.getByRole('button', { name: /Terjadwal/i }))
    expect(screen.getByText('Audit Terjadwal Besok')).toBeInTheDocument()
    expect(screen.queryByText('Antrean Orang Lain')).not.toBeInTheDocument()
    expect(screen.queryByText('Log Selesai')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Batalkan/i }))

    await waitFor(() => {
      expect(
        calls.some((c) => c.method === 'POST' && c.url === '/reports/exports/402/cancel'),
      ).toBe(true)
    })
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

  it.each([
    ['pdf', 'Laporan Audit (PDF)'],
    ['docx', 'Laporan Audit (DOCX)'],
  ] as const)('submits %s format to backend /reports/export', async (format, expectedName) => {
    on(
      'POST /reports/export',
      ok(
        {
          id: 300,
          type: 'audit',
          name: expectedName,
          status: 'pending',
          format,
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
        type="audit"
        title="Audit"
        onSuccess={onSuccess}
      />,
    )

    await userEvent.selectOptions(screen.getByLabelText(/Pilih Format File/i), format)
    await userEvent.click(screen.getByRole('button', { name: /Mulai Antrean Export/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })

    const post = calls.find((c) => c.method === 'POST' && c.url === '/reports/export')
    expect(post?.body).toMatchObject({ type: 'audit', format, name: expectedName })
  })

  it('schedules a one-time future export and rejects past timestamps client-side', async () => {
    on(
      'POST /reports/export',
      ok(
        {
          id: 501,
          type: 'barang',
          name: 'Stok Besok Pagi',
          status: 'scheduled',
          format: 'xlsx',
          schedule_type: 'once',
          scheduled_at: '2030-01-15T01:00:00Z',
          timezone: 'Asia/Jakarta',
          is_mine: true,
          created_at: new Date().toISOString(),
        },
        202,
      ),
    )

    const onSuccess = vi.fn()
    wrap(
      <ExportModal
        open={true}
        onOpenChange={vi.fn()}
        type="barang"
        title="Barang"
        onSuccess={onSuccess}
      />,
    )

    await userEvent.selectOptions(screen.getByLabelText(/Pilih Format File/i), 'xlsx')
    await userEvent.selectOptions(screen.getByLabelText(/Waktu Eksekusi/i), 'once')

    const dateInput = screen.getByLabelText(/Tanggal & Waktu Eksekusi/i)
    await userEvent.clear(dateInput)
    await userEvent.type(dateInput, '2020-01-01T08:00')
    await userEvent.click(screen.getByRole('button', { name: /Simpan Jadwal Export/i }))

    expect(await screen.findByText(/harus di masa depan/i)).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST' && c.url === '/reports/export')).toBe(false)

    await userEvent.clear(dateInput)
    await userEvent.type(dateInput, '2030-01-15T08:00')
    const nameInput = screen.getByLabelText(/Nama Laporan/i)
    await userEvent.type(nameInput, 'Stok Besok Pagi')
    await userEvent.click(screen.getByRole('button', { name: /Simpan Jadwal Export/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })

    const post = calls.find((c) => c.method === 'POST' && c.url === '/reports/export')
    expect(post?.body).toMatchObject({
      type: 'barang',
      format: 'xlsx',
      name: 'Stok Besok Pagi',
      scheduled_at: new Date('2030-01-15T08:00').toISOString(),
    })
    expect((post?.body as Record<string, unknown>).cron_expression).toBeUndefined()
    expect((post?.body as Record<string, unknown>).schedule_preset).toBeUndefined()
  })

  it('schedules a recurring preset export (weekly) and custom 5-field cron export', async () => {
    on(
      'POST /reports/export',
      ok(
        {
          id: 502,
          type: 'audit',
          name: 'Laporan Audit (PDF)',
          status: 'scheduled',
          format: 'pdf',
          schedule_type: 'recurring',
          cron_expression: '30 9 * * 3',
          timezone: 'Asia/Jakarta',
          scheduled_at: '2030-01-16T02:30:00Z',
          is_mine: true,
          created_at: new Date().toISOString(),
        },
        202,
      ),
    )

    const onSuccess = vi.fn()
    wrap(
      <ExportModal
        open={true}
        onOpenChange={vi.fn()}
        type="audit"
        title="Audit"
        onSuccess={onSuccess}
      />,
    )

    await userEvent.selectOptions(screen.getByLabelText(/Pilih Format File/i), 'pdf')
    await userEvent.selectOptions(screen.getByLabelText(/Waktu Eksekusi/i), 'recurring')
    await userEvent.selectOptions(screen.getByLabelText(/Pola Pengulangan/i), 'weekly')

    const timeInput = screen.getByLabelText(/Jam Eksekusi/i)
    await userEvent.clear(timeInput)
    await userEvent.type(timeInput, '09:30')
    await userEvent.selectOptions(screen.getByLabelText(/^Hari$/i), '3')
    await userEvent.click(screen.getByRole('button', { name: /Simpan Jadwal Export/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    const weeklyPost = calls.find((c) => c.method === 'POST' && c.url === '/reports/export')
    expect(weeklyPost?.body).toMatchObject({
      type: 'audit',
      format: 'pdf',
      schedule_preset: 'weekly',
      schedule_time: '09:30',
      schedule_day_of_week: 3,
    })

    // Test custom cron validation & submit
    await userEvent.selectOptions(screen.getByLabelText(/Waktu Eksekusi/i), 'recurring')
    await userEvent.selectOptions(screen.getByLabelText(/Pola Pengulangan/i), 'cron')

    const cronInput = screen.getByLabelText(/Ekspresi Cron/i)
    await userEvent.clear(cronInput)
    await userEvent.type(cronInput, '0 8')
    await userEvent.click(screen.getByRole('button', { name: /Simpan Jadwal Export/i }))
    expect(await screen.findByText(/Ekspresi cron 5-field tidak valid/i)).toBeInTheDocument()

    await userEvent.clear(cronInput)
    await userEvent.type(cronInput, '30 7 * * 1-5')
    await userEvent.click(screen.getByRole('button', { name: /Simpan Jadwal Export/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(2)
    })

    const postCalls = calls.filter((c) => c.method === 'POST' && c.url === '/reports/export')
    expect(postCalls[1]?.body).toMatchObject({
      type: 'audit',
      format: 'pdf',
      cron_expression: '30 7 * * 1-5',
    })
  })
})
