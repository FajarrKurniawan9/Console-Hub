import { z } from 'zod'
import type * as T from './types'

const iso = z.iso.datetime({ offset: true })
const int = z.number().int()
const qty = z.number().int().nonnegative()

export const uiUser = z.object({ id: int, name: z.string(), email: z.string() })

export const itemKind = z.enum(['BB', 'BJ'])
export const activeStatus = z.enum(['aktif', 'nonaktif'])

const stockTotals = z.object({ on_hand: qty, reserved: qty, available: qty })

export const item = z.object({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  kind: itemKind,
  unit: z.string(),
  min_stock: qty,
  status: activeStatus,
  version: int,
  locked: z.boolean(),
  stock: stockTotals,
})

export const itemDetail = item.extend({
  racks: z.array(
    z.object({
      rack_id: z.uuid(),
      rack_code: z.string(),
      rack_name: z.string(),
      on_hand: qty,
      reserved: qty,
      available: qty,
    }),
  ),
})

export const rack = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  capacity: qty.nullable(),
  status: activeStatus,
  version: int,
  item_count: qty,
})

export const stockLine = z.object({
  item_id: z.uuid(),
  sku: z.string(),
  item_name: z.string(),
  unit: z.string(),
  rack_id: z.uuid(),
  rack_code: z.string(),
  on_hand: qty,
  reserved: qty,
  available: qty,
})

export const movementType = z.enum([
  'initial',
  'adjust_add',
  'adjust_correct',
  'reserve',
  'release',
  'consume',
])

export const stockMovement = z.object({
  id: int,
  occurred_at: iso,
  item_id: z.uuid(),
  sku: z.string(),
  item_name: z.string(),
  rack_id: z.uuid().nullable(),
  rack_code: z.string().nullable(),
  type: movementType,
  quantity: int,
  balance_after: qty,
  reason: z.string().nullable(),
  actor: z.string().nullable(),
  order_code: z.string().nullable(),
})

export const reservationStatus = z.enum(['aktif', 'dilepas', 'dipakai'])
export const reservation = z.object({
  id: z.uuid(),
  order_code: z.string(),
  item_id: z.uuid(),
  sku: z.string(),
  item_name: z.string(),
  quantity: qty,
  status: reservationStatus,
  created_at: iso,
  closed_at: iso.nullable(),
})

export const areaAccess = z.object({
  employee_nik: z.string(),
  employee_name: z.string(),
  area: z.string(),
  granted_at: iso,
  revoked_at: iso.nullable(),
})

export const logLevel = z.enum(['debug', 'info', 'warn', 'error'])
export const logEntry = z.object({
  id: int,
  occurred_at: iso,
  level: logLevel,
  message: z.string(),
  actor: z.string().nullable(),
})

export const dashboard = z.object({
  counts: z.object({
    items: qty,
    racks: qty,
    active_reservations: qty,
    low_stock: qty,
  }),
  low_stock: z.array(
    z.object({
      item_id: z.uuid(),
      sku: z.string(),
      name: z.string(),
      unit: z.string(),
      available: qty,
      min_stock: qty,
    }),
  ),
  recent_movements: z.array(stockMovement),
})

export const errorCode = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'VERSION_CONFLICT',
  'LOCKED',
  'RACK_NOT_EMPTY',
  'DUPLICATE_CODE',
  'ITEM_INACTIVE',
  'RACK_INACTIVE',
  'INSUFFICIENT_STOCK',
  'IDEMPOTENCY_KEY_REUSED',
  'RATE_LIMITED',
  'SERVER_ERROR',
])

export const apiErrorBody = z.object({
  error: z.object({
    code: errorCode,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})

export const adjustmentResult = z.object({ movement: stockMovement, line: stockLine })
export const loginResult = z.object({ token: z.string(), user: uiUser })

/** `{ data: T }` */
export const dataOf = <S extends z.ZodType>(s: S) => z.object({ data: s })
/** `{ data: T[], meta: { next_cursor } }` */
export const pagedOf = <S extends z.ZodType>(s: S) =>
  z.object({ data: z.array(s), meta: z.object({ next_cursor: z.string().nullable() }) })

// Penjaga kontrak: gagal kompilasi bila types.ts dan skema di atas menyimpang.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : ['tidak sinkron', A, B]) : ['tidak sinkron', A, B]
export type ContractChecks = [
  Same<z.infer<typeof uiUser>, T.UiUser>,
  Same<z.infer<typeof item>, T.Item>,
  Same<z.infer<typeof itemDetail>, T.ItemDetail>,
  Same<z.infer<typeof rack>, T.Rack>,
  Same<z.infer<typeof stockLine>, T.StockLine>,
  Same<z.infer<typeof stockMovement>, T.StockMovement>,
  Same<z.infer<typeof reservation>, T.Reservation>,
  Same<z.infer<typeof areaAccess>, T.AreaAccess>,
  Same<z.infer<typeof logEntry>, T.LogEntry>,
  Same<z.infer<typeof dashboard>, T.Dashboard>,
  Same<z.infer<typeof apiErrorBody>, T.ApiErrorBody>,
  Same<z.infer<typeof adjustmentResult>, T.AdjustmentResult>,
  Same<z.infer<ReturnType<typeof pagedOf<typeof rack>>>, T.Paged<T.Rack>>,
]
const contractOk: ContractChecks extends true[] ? true : false = true
void contractOk
