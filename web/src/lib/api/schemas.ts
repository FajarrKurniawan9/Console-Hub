// Portal API contract (/api/v1), brief v3 section 5. Every response is parsed against these schemas.
import { z } from 'zod'

export const one = <T extends z.ZodType>(item: T) => z.object({ data: item })
export const many = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({ next_cursor: z.string().nullable(), total: z.number().nullable() }),
  })
export type Page<T> = { data: T[]; meta: { next_cursor: string | null; total: number | null } }

export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'TRANSACTION_REFUSED',
  'VERSION_CONFLICT',
  'LOCKED',
  'CONFLICT',
  'CONSOLE_ERROR',
  'CONSOLE_UNREACHABLE',
  'CONSOLE_TIMEOUT',
  'INTERNAL_ERROR',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export const apiErrorBody = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBody>

const iso = z.string()
const ref = z.object({ id: z.string(), name: z.string() })

// ---- Auth ----

export const PERMISSIONS = [
  'karyawan.view',
  'karyawan.create',
  'karyawan.update',
  'karyawan.delete',
  'divisi.view',
  'divisi.create',
  'divisi.update',
  'divisi.delete',
  'barang.view',
  'barang.create',
  'barang.update',
  'barang.delete',
  'pesanan.view',
  'pesanan.create',
  'pesanan.complete',
  'pesanan.cancel',
  'admin.dashboard.view',
  'admin.logs.view',
  'admin.consoles.view',
  'admin.consoles.manage',
  'admin.transactions.view',
  'admin.transactions.resolve',
  'admin.consistency.view',
  'admin.consistency.repair',
  'admin.rbac.manage',
  'admin.audit.view',
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const authUser = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  // Brief: 'admin_it' | 'user'. Widened to string because RBAC can hold more roles (design-notes).
  role: z.object({ code: z.string(), name: z.string() }),
  // Unknown strings are kept (a newer backend may add some); checks only look for known ones.
  permissions: z.array(z.string()),
})
export type AuthUser = z.infer<typeof authUser>
export const loginResult = z.object({ token: z.string(), user: authUser })

// ---- Work data ----

const activeStatus = z.enum(['aktif', 'nonaktif'])

export const division = z.object({
  id: z.string(),
  kode: z.string(),
  nama: z.string(),
  status: activeStatus,
  version: z.number(),
})
export type Division = z.infer<typeof division>

export const employee = z.object({
  id: z.string(),
  nik: z.string(),
  name: z.string(),
  division: z.object({ id: z.string(), nama: z.string() }),
  position: z.string().nullable(),
  status: activeStatus,
  version: z.number(),
  areas: z.array(z.string()),
  teams: z.array(z.string()),
})
export type Employee = z.infer<typeof employee>

export const item = z.object({
  id: z.string(),
  sku: z.string(),
  nama: z.string(),
  jenis: z.enum(['bahan_baku', 'barang_jadi']),
  satuan: z.string(),
  harga_jual_idr: z.number().nullable(),
  min_stock: z.number(),
  status: activeStatus,
  version: z.number(),
  stok_tersedia: z.number(),
  pic: ref.nullable(),
})
export type Item = z.infer<typeof item>

export const orderLine = z.object({
  item_id: z.string(),
  sku: z.string(),
  nama: z.string(),
  qty: z.number(),
  unit_price_idr: z.number(),
})
export type OrderLine = z.infer<typeof orderLine>

export const orderStatus = z.enum(['ANTRE', 'SELESAI', 'DIBATALKAN'])
export type OrderStatus = z.infer<typeof orderStatus>
export const order = z.object({
  id: z.string(),
  order_no: z.string(),
  customer: z.string(),
  pic: ref,
  status: orderStatus,
  lines: z.array(orderLine),
  created_at: iso,
  version: z.number(),
})
export type Order = z.infer<typeof order>

/** `?verify=all` on admin detail pages. Shape assumed (brief 8.5 names it only); see design-notes. */
export const verifyResult = z.object({
  in_sync: z.boolean(),
  consoles: z.array(
    z.object({
      console: z.object({ slug: z.string(), name: z.string() }),
      version: z.number().nullable(),
      status: z.enum(['match', 'missing', 'version_mismatch', 'checksum_mismatch', 'unreachable']),
    }),
  ),
})
export type VerifyResult = z.infer<typeof verifyResult>
export const withConsistency = <T extends z.ZodObject>(s: T) =>
  s.extend({ consistency: verifyResult.optional() })

// ---- Transactions ----

export const TX_STATES = [
  'preparing',
  'prepared',
  'committing',
  'committed',
  'aborting',
  'aborted',
  'needs_attention',
] as const
export const txState = z.enum(TX_STATES)
export type TxState = z.infer<typeof txState>
export const FINAL_TX_STATES: TxState[] = ['committed', 'aborted', 'needs_attention']

export const consoleSlug = z.enum(['hr', 'gudang', 'produksi'])
export type ConsoleSlug = z.infer<typeof consoleSlug>

export const txParticipant = z.object({
  console: z.object({ slug: consoleSlug, name: z.string() }),
  prepare_state: z.enum(['pending', 'ok', 'refused', 'error']),
  decision_state: z.enum(['pending', 'committed', 'aborted', 'failed']),
  refusal_code: z.string().optional(),
  refusal_message: z.string().optional(),
  attempts: z.number(),
  last_error: z.string().nullable().optional(),
  prepared_at: iso.nullable().optional(),
  finished_at: iso.nullable().optional(),
})
export type TxParticipant = z.infer<typeof txParticipant>

export const transaction = z.object({
  id: z.string(),
  operation: z.string(),
  entity_type: z.string().nullable(),
  entity_id: z.string().nullable(),
  state: txState,
  requested_by: z.object({ id: z.number(), name: z.string() }),
  created_at: iso,
  decided_at: iso.nullable(),
  finished_at: iso.nullable(),
  failure_code: z.string().nullable(),
  failure_message: z.string().nullable(),
  participants: z.array(txParticipant),
  payload: z.unknown().optional(),
})
export type Transaction = z.infer<typeof transaction>

/** `GET /transactions/{id}`: what the owner of a 202 write may see. */
export const txStatus = z.object({ id: z.string(), state: txState, message: z.string().optional() })
export type TxStatus = z.infer<typeof txStatus>

/** Body of a successful (200/201/202) write. `entity` may be absent on 202. */
export const writeResult = <T extends z.ZodType>(entity: T) =>
  one(
    z.object({
      transaction: z.object({ id: z.string(), state: txState }),
      entity: entity.optional(),
    }),
  )

export const refusal = z.object({
  console: z.string(),
  code: z.string(),
  message: z.string(),
})
export type Refusal = z.infer<typeof refusal>

// ---- Admin ----

export const consoleStatus = z.enum(['ok', 'slow', 'down', 'unknown'])
export type ConsoleStatus = z.infer<typeof consoleStatus>
export const logLevel = z.enum(['debug', 'info', 'warn', 'error'])
export type LogLevel = z.infer<typeof logLevel>

export const consoleInfo = z.object({
  id: z.number(),
  slug: consoleSlug,
  name: z.string(),
  base_url: z.string(),
  status: consoleStatus,
  last_latency_ms: z.number().nullable(),
  last_checked_at: iso.nullable(),
  last_error: z.string().nullable(),
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
  tx_id: z.string().nullable(),
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

export const consistencyCheck = z.object({
  id: z.number(),
  entity_type: z.enum(['divisi', 'karyawan', 'barang']),
  status: z.enum(['running', 'clean', 'drift', 'failed']),
  checked_count: z.number(),
  drift_count: z.number(),
  started_at: iso,
  finished_at: iso.nullable(),
})
export type ConsistencyCheck = z.infer<typeof consistencyCheck>

export const consistencyFinding = z.object({
  id: z.number(),
  check_id: z.number(),
  entity_type: z.string(),
  entity_id: z.string(),
  label: z.string(),
  console: z.object({ slug: z.string(), name: z.string() }),
  kind: z.enum(['missing', 'version_mismatch', 'checksum_mismatch']),
  owner_version: z.number().nullable(),
  console_version: z.number().nullable(),
  repaired_at: iso.nullable(),
})
export type ConsistencyFinding = z.infer<typeof consistencyFinding>
export const consistencyCheckDetail = consistencyCheck.extend({
  findings: z.array(consistencyFinding),
})
export type ConsistencyCheckDetail = z.infer<typeof consistencyCheckDetail>

export const overview = z.object({
  consoles: z.array(consoleInfo),
  error_logs_24h: z.number(),
  tx_counts: z.partialRecord(txState, z.number()),
  recent_transactions: z.array(transaction),
  last_consistency: consistencyCheck.nullable(),
})
export type Overview = z.infer<typeof overview>

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
