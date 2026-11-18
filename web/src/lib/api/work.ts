// Work data endpoints (brief v3 §5). Used by both shells.
import { z } from 'zod'
import { params, request } from './client'
import {
  division,
  employee,
  FINAL_TX_STATES,
  item,
  many,
  one,
  order,
  transaction,
  txStatus,
  withConsistency,
  writeResult,
  type Page,
  type TxState,
  type VerifyResult,
} from './schemas'

export type ListQuery = { q?: string; status?: string; cursor?: string | null; limit?: number }

export const RESOURCES = {
  divisions: { path: '/divisions', schema: division },
  employees: { path: '/employees', schema: employee },
  items: { path: '/items', schema: item },
  orders: { path: '/orders', schema: order },
} as const
export type Resource = keyof typeof RESOURCES
export type Row<R extends Resource> = z.infer<(typeof RESOURCES)[R]['schema']>

export function listOf<R extends Resource>(r: R, q: ListQuery = {}): Promise<Page<Row<R>>> {
  const { path, schema } = RESOURCES[r]
  return request(many(schema), { url: path, params: params({ limit: 100, ...q }) }) as Promise<
    Page<Row<R>>
  >
}

export function getOne<R extends Resource>(
  r: R,
  id: string,
  verify = false,
): Promise<Row<R> & { consistency?: VerifyResult }> {
  const { path, schema } = RESOURCES[r]
  return request(one(withConsistency(schema)), {
    url: `${path}/${id}`,
    params: verify ? { verify: 'all' } : undefined,
  }).then((x) => x.data as Row<R> & { consistency?: VerifyResult })
}

/** One user intent. `key` is reused when the same intent is retried. */
export type WriteCall = { method: 'POST' | 'PATCH' | 'DELETE'; url: string; data?: unknown }

export function sendWrite(call: WriteCall, key: string) {
  return request(writeResult(z.unknown()), { ...call, idempotencyKey: key }).then((r) => r.data)
}

/** 202 follow-up. User gets `{id, state, message?}`; Admin IT the full transaction. */
export function txState(id: string, admin: boolean): Promise<{ state: TxState; message?: string }> {
  return admin
    ? request(one(transaction), { url: `/admin/transactions/${id}` }).then((r) => ({
        state: r.data.state,
        message: r.data.failure_message ?? undefined,
      }))
    : request(one(txStatus), { url: `/transactions/${id}` }).then((r) => r.data)
}

export const isFinal = (s: TxState) => FINAL_TX_STATES.includes(s)
