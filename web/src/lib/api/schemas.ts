// Portal API contract (/api/v1), prompt v3 update 2 §3. Every response is parsed against these schemas.
import { z } from 'zod'

export const SOURCES = ['gudang', 'produksi', 'hr'] as const
export const source = z.enum(SOURCES)
export type Source = z.infer<typeof source>

export const one = <T extends z.ZodType>(item: T) => z.object({ data: item })
export const listMeta = z.object({
  next_cursor: z.string().nullable(),
  /** Sources that were down while the hub merged this page. */
  unavailable: z.array(source).optional(),
  /** Admin lists (logs, audit) still report a total. */
  total: z.number().nullable().optional(),
})
export type ListMeta = z.infer<typeof listMeta>
export const many = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: listMeta })
export type Page<T> = { data: T[]; meta: ListMeta }

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'VERSION_CONFLICT',
  'REFERENCE_NOT_FOUND',
  'REFERENCED',
  'SOURCE_UNREACHABLE',
  'SOURCE_TIMEOUT',
  'RATE_LIMITED',
  'CONFLICT',
  'SERVER_ERROR',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export const apiErrorBody = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBody>

/** `details.used_by` on 409 REFERENCED (Admin IT only). */
export const usedBy = z.array(
  z.object({ source, type: z.string(), id: z.string(), name: z.string() }),
)
export type UsedBy = z.infer<typeof usedBy>

const iso = z.string()

// ---- Auth ----

export const PERMISSIONS = [
  'barang.view',
  'barang.create',
  'barang.update',
  'barang.delete',
  'produksi.view',
  'produksi.create',
  'produksi.update',
  'produksi.delete',
  'personel.view',
  'personel.create',
  'personel.update',
  'personel.delete',
  'lacak.view',
  'dashboard.view',
  'admin.dashboard.view',
  'admin.logs.view',
  'admin.consoles.view',
  'admin.consoles.manage',
  'admin.rbac.manage',
  'admin.audit.view',
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const authUser = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  // 'admin_it' | 'user', widened to string because RBAC can hold more roles (design-notes).
  role: z.object({ code: z.string(), name: z.string() }),
  // Unknown strings are kept (a newer backend may add some); checks only look for known ones.
  permissions: z.array(z.string()),
})
export type AuthUser = z.infer<typeof authUser>
export const loginResult = z.object({ token: z.string(), user: authUser })
export const requestOtpResult = z.object({
  message: z.string().optional(),
  expires_in: z.number().optional(),
  resend_token: z.string().optional(),
})
export type RequestOtpResult = z.infer<typeof requestOtpResult>

// ---- Work data (merged by the hub from three sources) ----

export const activeStatus = z.enum(['aktif', 'nonaktif'])
export type Status = z.infer<typeof activeStatus>

export const personRef = z.object({ id: z.string(), name: z.string(), role: z.string() })
export type PersonRef = z.infer<typeof personRef>
export const productionRef = z.object({
  id: z.string(),
  area: z.string(),
  production_type: z.string(),
})
export type ProductionRef = z.infer<typeof productionRef>

const stamps = {
  status: activeStatus,
  version: z.number(),
  created_at: iso,
  updated_at: iso,
}

export const person = z.object({ id: z.string(), name: z.string(), role: z.string(), ...stamps })
export type Person = z.infer<typeof person>

export const production = z.object({
  id: z.string(),
  area: z.string(),
  production_type: z.string(),
  courier_id: z.string().nullable(),
  // Merged by the hub; null when unset or when HR is unavailable.
  courier: personRef.nullable(),
  ...stamps,
})
export type Production = z.infer<typeof production>

export const item = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  production_id: z.string().nullable(),
  production: productionRef.nullable(),
  responsible_id: z.string().nullable(),
  responsible: personRef.nullable(),
  quantity: z.number(),
  unit: z.string(),
  ...stamps,
})
export type Item = z.infer<typeof item>

export const sourceStatus = z.object({
  source,
  status: z.enum(['ok', 'unavailable', 'not_found']),
  latency_ms: z.number().nullable(),
})
export type SourceStatus = z.infer<typeof sourceStatus>

export const trackingResult = z.object({
  item,
  production: production.nullable(),
  responsible: personRef.nullable(),
  courier: personRef.nullable(),
  warnings: z.array(z.string()),
  /** Only for accounts with `admin.consoles.view`. */
  sources: z.array(sourceStatus).optional(),
})
export type TrackingResult = z.infer<typeof trackingResult>

// ---- Admin ----

export const consoleStatus = z.enum(['ok', 'slow', 'down', 'unknown'])
export type ConsoleStatus = z.infer<typeof consoleStatus>
export const logLevel = z.enum(['debug', 'info', 'warn', 'error'])
export type LogLevel = z.infer<typeof logLevel>

/** One source API as registered in the hub. */
export const consoleInfo = z.object({
  id: z.number(),
  slug: source,
  name: z.string(),
  base_url: z.string(),
  is_active: z.boolean(),
  status: consoleStatus,
  latency_ms: z.number().nullable(),
  last_checked_at: iso.nullable(),
})
export type ConsoleInfo = z.infer<typeof consoleInfo>

export const consoleTest = z.object({
  status: consoleStatus,
  latency_ms: z.number().nullable(),
  message: z.string(),
})
export type ConsoleTest = z.infer<typeof consoleTest>

export const logEntry = z.object({
  id: z.number(),
  console: z.object({ id: z.number(), slug: z.string(), name: z.string() }),
  occurred_at: iso,
  level: logLevel,
  message: z.string(),
  actor: z.string().nullable(),
  raw: z.unknown().optional(),
})
export type LogEntry = z.infer<typeof logEntry>

export const logSyncResult = z.array(
  z.object({
    console: z.object({ slug: z.string(), name: z.string() }),
    status: z.enum(['ok', 'failed']),
    inserted: z.number().nullable(),
    error: z.string().nullable(),
  }),
)
export type LogSyncResult = z.infer<typeof logSyncResult>

export const rbacUser = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.object({ code: z.string(), name: z.string() }),
  is_active: z.boolean(),
})
export type RbacUser = z.infer<typeof rbacUser>

export const rbacRole = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  permissions: z.array(z.string()),
})
export type RbacRole = z.infer<typeof rbacRole>

export const auditEvent = z.object({
  id: z.number(),
  user: z.object({ id: z.number(), name: z.string() }).nullable(),
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  console: z.object({ slug: z.string() }).nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  created_at: iso,
})
export type AuditEvent = z.infer<typeof auditEvent>

export const overview = z.object({
  sources: z.array(consoleInfo),
  log_errors_24h: z.number(),
  recent_audit: z.array(auditEvent),
})
export type Overview = z.infer<typeof overview>

export const dashboardTrendPoint = z.object({
  date: z.string(),
  created: z.number(),
  updated: z.number(),
  deactivated: z.number(),
})
export type DashboardTrendPoint = z.infer<typeof dashboardTrendPoint>

export const dashboardKindItem = z.object({
  kind: z.string(),
  count: z.number(),
  total_quantity: z.number(),
})
export type DashboardKindItem = z.infer<typeof dashboardKindItem>

export const itemDashboardSummary = z.object({
  total_items: z.number(),
  total_quantity: z.number(),
  transactions_count: z.number(),
  activity_trend: z.array(dashboardTrendPoint),
  kind_distribution: z.array(dashboardKindItem),
})
export type ItemDashboardSummary = z.infer<typeof itemDashboardSummary>

// ---- Reports & Export Scheduler ----

export const exportStatus = z.enum([
  'scheduled',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
])
export type ExportStatus = z.infer<typeof exportStatus>

export const exportScheduleType = z.enum(['immediate', 'once', 'recurring'])
export type ExportScheduleType = z.infer<typeof exportScheduleType>

export const reportExport = z.object({
  id: z.number(),
  type: z.string(), // 'audit' | 'logs' | 'barang'
  name: z.string(),
  status: exportStatus,
  format: z.string().default('csv'),
  schedule_type: exportScheduleType.optional(),
  cron_expression: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  scheduled_at: iso.nullable().optional(),
  cancelled_at: iso.nullable().optional(),
  parent_export_id: z.number().nullable().optional(),
  file_url: z.string().nullable().optional(),
  download_url: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  row_count: z.number().nullable().optional(),
  requester_role: z.string().nullable().optional(),
  requester_name: z.string().nullable().optional(),
  is_mine: z.boolean().optional(),
  queue_position: z.number().nullable().optional(),
  created_at: iso,
  completed_at: iso.nullable().optional(),
})
export type ReportExport = z.infer<typeof reportExport>

export const reportExportEnvelope = z.object({
  data: reportExport,
})

export const reportExportListEnvelope = z.object({
  data: z.array(reportExport),
})

