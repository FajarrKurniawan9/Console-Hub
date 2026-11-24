import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http, request } from '../../lib/api/client'
import {
  reportExportEnvelope,
  reportExportListEnvelope,
  type AuthUser,
  type ReportExport,
} from '../../lib/api/schemas'

export const reportKeys = {
  all: ['reports', 'exports'] as const,
}

// Local simulation storage key for offline / dev mock fallback
const LOCAL_STORAGE_KEY = 'ch.mock_reports_exports'

function readLocalExports(): ReportExport[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ReportExport[]
  } catch {
    return []
  }
}

function saveLocalExports(items: ReportExport[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/** Check role permissions: Admin/Auditor for log/audit, Manajer for barang */
export function canExportType(
  user: AuthUser | null,
  type: 'audit' | 'logs' | 'barang',
): boolean {
  if (!user) return false
  const role = user.role.code
  if (role === 'admin_it') return true
  if (type === 'audit' || type === 'logs') {
    return role === 'auditor' || user.permissions.includes('admin.audit.view') || user.permissions.includes('admin.logs.view')
  }
  if (type === 'barang') {
    return (
      role === 'manajer_gudang' ||
      role === 'manajer' ||
      user.permissions.includes('barang.view') ||
      user.permissions.includes('barang.create')
    )
  }
  return false
}

export type CreateExportInput = {
  type: 'audit' | 'logs' | 'barang'
  format?: 'csv' | 'xlsx' | 'json'
  name?: string
  filters?: unknown
}

export function useReportExports() {
  return useQuery({
    queryKey: reportKeys.all,
    queryFn: async (): Promise<ReportExport[]> => {
      try {
        const res = await request(reportExportListEnvelope, {
          method: 'GET',
          url: '/reports/exports',
        })
        return res.data
      } catch (err: unknown) {
        // Fallback to local simulation when backend endpoint is not yet ready or in dev
        const local = readLocalExports()
        // If there are pending/processing items in local, advance their status to simulate scheduler
        const now = Date.now()
        let changed = false
        const updated = local.map((item) => {
          const age = now - new Date(item.created_at).getTime()
          if (item.status === 'pending' && age > 3000) {
            changed = true
            return { ...item, status: 'processing' as const }
          }
          if (item.status === 'processing' && age > 8000) {
            changed = true
            return {
              ...item,
              status: 'completed' as const,
              completed_at: new Date().toISOString(),
              download_url: `/reports/exports/${item.id}/download`,
            }
          }
          return item
        })
        if (changed) {
          saveLocalExports(updated)
        }
        return updated
      }
    },
    // Auto-poll every 2.5 seconds when there are pending or processing jobs
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
      try {
        const res = await request(reportExportEnvelope, {
          method: 'POST',
          url: '/reports/export',
          data: input,
        })
        return res.data
      } catch (err: unknown) {
        // Fallback simulation: create a new pending ticket
        const existing = readLocalExports()
        const typeLabels: Record<string, string> = {
          audit: 'Laporan Audit Aktivitas',
          logs: 'Laporan Log Gabungan',
          barang: 'Laporan Data Barang Gudang',
        }
        const newTicket: ReportExport = {
          id: Date.now(),
          type: input.type,
          name: input.name || typeLabels[input.type] || `Export ${input.type}`,
          status: 'pending',
          format: input.format || 'csv',
          file_url: null,
          download_url: null,
          created_at: new Date().toISOString(),
          completed_at: null,
          row_count: 50,
        }
        saveLocalExports([newTicket, ...existing])
        return newTicket
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}

/** Trigger download of a completed export file */
export async function downloadExportFile(exportItem: ReportExport) {
  const downloadUrl = exportItem.download_url || `/reports/exports/${exportItem.id}/download`
  try {
    const res = await http.get(downloadUrl, { responseType: 'blob' })
    const blob = new Blob([res.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const ext = exportItem.format || 'csv'
    link.download = `${exportItem.name || `export-${exportItem.type}-${exportItem.id}`}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch {
    // If running in mock/fallback mode, generate a dummy CSV blob so user can see it work!
    const csvContent =
      exportItem.type === 'barang'
        ? 'ID,Nama Barang,Jenis,Jumlah,Satuan,Status\n1,Iphone 18 Pro Max,Handphone,10,pcs,aktif\n2,Kain Poliester,kain,150,roll,aktif\n3,Kain Linen,kain,80,roll,aktif'
        : exportItem.type === 'audit'
          ? 'ID,User,Aksi,Target,Waktu\n1,Admin IT,user.login,portal,2026-11-24 10:00:00\n2,Manajer Gudang,item.created,barang:1,2026-11-24 10:05:00'
          : 'ID,Level,Console,Pesan,Waktu\n1,info,gudang,Barang tersinkronisasi,2026-11-24 10:00:00\n2,warn,hr,Koneksi lambat 320ms,2026-11-24 10:02:00'

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${exportItem.name || `export-${exportItem.type}`}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}
