// Work data endpoints (update 2 §3.2). Used by both shells.
import type { z } from 'zod'
import { params, request } from './client'
import {
  item,
  many,
  one,
  person,
  production,
  trackingResult,
  type Page,
  type Source,
} from './schemas'

export type ListQuery = {
  q?: string
  status?: string
  kind?: string
  production_type?: string
  role?: string
  cursor?: string | null
  limit?: number
}

/** `owner` = the source API that holds the data; writes fail when it is down. */
export const RESOURCES = {
  items: { path: '/items', schema: item, owner: 'gudang', perm: 'barang' },
  productions: { path: '/productions', schema: production, owner: 'produksi', perm: 'produksi' },
  people: { path: '/people', schema: person, owner: 'hr', perm: 'personel' },
} as const satisfies Record<
  string,
  { path: string; schema: z.ZodType; owner: Source; perm: 'barang' | 'produksi' | 'personel' }
>
export type Resource = keyof typeof RESOURCES
export type Row<R extends Resource> = z.infer<(typeof RESOURCES)[R]['schema']>

export function listOf<R extends Resource>(r: R, q: ListQuery = {}): Promise<Page<Row<R>>> {
  const { path, schema } = RESOURCES[r]
  return request(many(schema), { url: path, params: params({ limit: 25, ...q }) }) as Promise<
    Page<Row<R>>
  >
}

export function getOne<R extends Resource>(r: R, id: string): Promise<Row<R>> {
  const { path, schema } = RESOURCES[r]
  return request(one(schema), { url: `${path}/${id}` }).then((x) => x.data as Row<R>)
}

export type WriteCall = { method: 'POST' | 'PATCH' | 'DELETE'; url: string; data?: unknown }

/** 200/201 with the entity as written. */
export function sendWrite<R extends Resource>(r: R, call: WriteCall): Promise<Row<R>> {
  return request(one(RESOURCES[r].schema), call).then((x) => x.data as Row<R>)
}

export function trackItem(id: string) {
  return request(one(trackingResult), { url: `/tracking/items/${id}` }).then((x) => x.data)
}
