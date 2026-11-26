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

export type ExportScheduleMode = 'immediate' | 'once' | 'recurring'
export type SchedulePreset = 'daily' | 'weekly' | 'monthly'

export const SCHEDULE_PRESETS = [
  { value: 'daily', label: 'Setiap Hari (Harian)' },
  { value: 'weekly', label: 'Setiap Minggu (Mingguan)' },
  { value: 'monthly', label: 'Setiap Bulan (Bulanan)' },
] as const

export const SCHEDULE_WEEKDAYS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 0, label: 'Minggu' },
] as const

export function defaultExportTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta'
  } catch {
    return 'Asia/Jakarta'
  }
}

export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function defaultTomorrowMorningInput(now = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0, 0)
  return toLocalDateTimeInputValue(next)
}

export function describeSchedule(
  item: Pick<ReportExport, 'schedule_type' | 'cron_expression' | 'timezone'>,
): string | null {
  if (item.schedule_type !== 'recurring' || !item.cron_expression) return null
  const [min, hour, dom, month, dow, extra] = item.cron_expression.trim().split(/\s+/)
  if (!min || !hour || !dom || !month || !dow || extra) {
    return `Rutin (${item.cron_expression})`
  }
  const hhmm =
    /^\d+$/.test(hour) && /^\d+$/.test(min)
      ? `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
      : null
  const tz = item.timezone || 'Asia/Jakarta'

  if (hhmm && dom === '*' && month === '*' && dow === '*') {
    return `Setiap hari pukul ${hhmm} (${tz})`
  }
  if (hhmm && dom === '*' && month === '*' && /^[0-6]$/.test(dow)) {
    const day = SCHEDULE_WEEKDAYS.find((d) => String(d.value) === dow)?.label ?? `hari #${dow}`
    return `Setiap ${day} pukul ${hhmm} (${tz})`
  }
  if (hhmm && /^\d+$/.test(dom) && month === '*' && dow === '*') {
    return `Setiap tanggal ${dom} pukul ${hhmm} (${tz})`
  }
  return `Jadwal cron (${tz})`
}

export type CreateExportInput = {
  type: ExportType
  format?: ExportFormat
  name?: string
  filters?: unknown
  scheduled_at?: string
  cron_expression?: string
  schedule_preset?: SchedulePreset
  schedule_time?: string
  schedule_day_of_week?: number
  schedule_day_of_month?: number
  timezone?: string
}

export function useReportExports(enabled = true, watchScheduled = false) {
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
    // Auto-poll every 2.5s while any queue ticket is active; poll gently for scheduled items.
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      const hasActive = data.some((e) => e.status === 'pending' || e.status === 'processing')
      if (hasActive) return 2500
      const scheduled = data.filter((e) => e.status === 'scheduled')
      if (scheduled.length > 0) {
        if (watchScheduled) return 10_000
        const nowMs = Date.now()
        const dueSoon = scheduled.some((e) => {
          if (!e.scheduled_at) return false
          const dueMs = Date.parse(e.scheduled_at)
          return !Number.isNaN(dueMs) && dueMs - nowMs <= 120_000
        })
        return dueSoon ? 10_000 : 30_000
      }
      return false
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

export function useCancelExport() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (exportId: number): Promise<ReportExport> => {
      const res = await request(reportExportEnvelope, {
        method: 'POST',
        url: `/reports/exports/${exportId}/cancel`,
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
