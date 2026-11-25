import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ApiError, http, request, toApiError } from '../../lib/api/client'
import {
  apiErrorBody,
  reportExportEnvelope,
  reportExportListEnvelope,
  type AuthUser,
  type Permission,
  type ReportExport,
} from '../../lib/api/schemas'

export const reportKeys = {
  all: ['reports', 'exports'] as const,
}

export type ExportType = 'audit' | 'logs' | 'barang'

export const EXPORT_FORMATS = [
  {
    value: 'csv',
    label: 'CSV (Comma-Separated Values)',
    hint: 'Paling cepat dan ringan untuk olah data mentah di Excel / Google Sheets.',
  },
  {
    value: 'xlsx',
    label: 'Excel Spreadsheet (.xlsx)',
    hint: 'Workbook Excel siap pakai dengan header dan kolom rapi.',
  },
  {
    value: 'pdf',
    label: 'PDF Document (.pdf)',
    hint: 'Cocok untuk laporan resmi siap cetak dan arsip audit.',
  },
  {
    value: 'docx',
    label: 'Word Document (.docx)',
    hint: 'Cocok jika dokumen laporan masih perlu diedit atau diberi catatan.',
  },
  {
    value: 'json',
    label: 'JSON Raw Format (.json)',
    hint: 'Format data mentah terstruktur untuk kebutuhan integrasi teknis.',
  },
] as const

export type ExportFormat = (typeof EXPORT_FORMATS)[number]['value']

export const EXPORT_PERMISSIONS: Record<ExportType, Permission> = {
  audit: 'admin.audit.view',
  logs: 'admin.logs.view',
  barang: 'barang.view',
}

/** Matches backend RBAC checks in ReportExportController. */
export function canExportType(user: AuthUser | null, type: ExportType): boolean {
  if (!user) return false
  return user.permissions.includes(EXPORT_PERMISSIONS[type])
}

/** True when the user holds at least one permission required to access /reports/exports. */
export function canAccessExportQueue(user: AuthUser | null): boolean {
  if (!user) return false
  return Object.values(EXPORT_PERMISSIONS).some((perm) => user.permissions.includes(perm))
}

export type CreateExportInput = {
  type: ExportType
  format?: ExportFormat
  name?: string
  filters?: unknown
}

export function useReportExports(enabled = true) {
  return useQuery({
    queryKey: reportKeys.all,
    enabled,
    queryFn: async (): Promise<ReportExport[]> => {
      const res = await request(reportExportListEnvelope, {
        method: 'GET',
        url: '/reports/exports',
      })
      return res.data
    },
    // Auto-poll every 2.5 seconds while any ticket in the shared waiting list is active.
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      const hasActive = data.some((e) => e.status === 'pending' || e.status === 'processing')
      return hasActive ? 2500 : false
    },
  })
}

export function useCreateExport() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateExportInput): Promise<ReportExport> => {
      const res = await request(reportExportEnvelope, {
        method: 'POST',
        url: '/reports/export',
        data: input,
      })
      return res.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}

/** Ensure download URL stays relative to Axios baseURL (/api/v1) without duplicating it. */
export function normalizeDownloadUrl(exportItem: ReportExport): string {
  const raw = exportItem.download_url || `/reports/exports/${exportItem.id}/download`
  const base = (http.defaults.baseURL ?? '').replace(/\/+$/, '')
  if (base && raw.startsWith(`${base}/`)) {
    return raw.slice(base.length)
  }
  if (raw.startsWith('/api/v1/')) {
    return raw.slice('/api/v1'.length)
  }
  return raw
}

function filenameFromDisposition(header: unknown, exportItem: ReportExport): string {
  if (typeof header === 'string') {
    const utf8Match = header.match(/filename\*=UTF-8''([^;\s]+)/i)
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1])
      } catch {
        // fall through to standard filename match
      }
    }
    const basicMatch = header.match(/filename="?([^";]+)"?/i)
    if (basicMatch?.[1]) {
      return basicMatch[1]
    }
  }
  const ext = exportItem.format || 'csv'
  const base = (exportItem.name || `export-${exportItem.type}-${exportItem.id}`).trim()
  return base.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? base : `${base}.${ext}`
}

async function parseBlobError(err: unknown): Promise<ApiError> {
  if (err instanceof AxiosError && err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text()
      const parsed = apiErrorBody.safeParse(JSON.parse(text))
      if (parsed.success) {
        return new ApiError(parsed.data.error.code, parsed.data.error.message, err.response.status, {
          details: parsed.data.error.details,
        })
      }
    } catch {
      // fall back to generic mapping
    }
  }
  return toApiError(err)
}

/** Trigger download of a completed export file directly from the backend. */
export async function downloadExportFile(exportItem: ReportExport) {
  const downloadUrl = normalizeDownloadUrl(exportItem)
  try {
    const res = await http.get<Blob>(downloadUrl, { responseType: 'blob' })
    const contentType =
      typeof res.headers?.['content-type'] === 'string'
        ? res.headers['content-type']
        : undefined
    const blob =
      res.data instanceof Blob
        ? res.data
        : new Blob([res.data as BlobPart], contentType ? { type: contentType } : undefined)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filenameFromDisposition(res.headers?.['content-disposition'], exportItem)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (err: unknown) {
    throw await parseBlobError(err)
  }
}
