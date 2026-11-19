import {
  adjustmentResult,
  areaAccess,
  dashboard,
  item,
  itemDetail,
  logEntry,
  rack,
  reservation,
  stockLine,
  stockMovement,
} from '../../lib/api/schemas'
import { invalid } from '../engine/errors'
import { adjustStock, createRack, db, updateRack } from '../engine/state'
import { fail, json, one, paged, query, route } from '../http'
import { getScenario } from '../scenarios'

const id = (p: Record<string, string | readonly string[] | undefined>) => String(p.id)

/** Skenario `validation-error`: simpan selalu ditolak dengan galat per field. */
const forcedInvalid = (fields: Record<string, string>) => {
  if (getScenario() === 'validation-error') throw invalid(fields)
}

const EMPTY_DASHBOARD = {
  counts: { items: 0, racks: 0, active_reservations: 0, low_stock: 0 },
  low_stock: [],
  recent_movements: [],
}

export const gudangHandlers = [
  route('get', '/dashboard', () =>
    one(dashboard, getScenario() === 'empty' ? EMPTY_DASHBOARD : db.dashboard()),
  ),

  route('get', '/items', ({ request }) => paged(item, db.listItems(query(request)), request)),
  route('get', '/items/:id', ({ params }) => one(itemDetail, db.getItem(id(params)))),

  route('get', '/racks', ({ request }) => paged(rack, db.listRacks(query(request)), request)),
  route('post', '/racks', async ({ request, actor }) => {
    forcedInvalid({ code: 'Kode rak tidak diterima server.', name: 'Nama rak tidak diterima server.' })
    return one(rack, createRack(await json(request), actor), 201)
  }),
  route('get', '/racks/:id', ({ params }) => one(rack, db.getRack(id(params)))),
  route('patch', '/racks/:id', async ({ request, params, actor }) => {
    forcedInvalid({ name: 'Nama rak tidak diterima server.' })
    return one(rack, updateRack(id(params), await json(request), actor))
  }),

  route('get', '/stock', ({ request }) => paged(stockLine, db.listStock(query(request)), request)),
  route('post', '/stock/adjustments', async ({ request, actor }) => {
    const key = request.headers.get('Idempotency-Key')
    if (!key) return fail('VALIDATION_ERROR', 'Header Idempotency-Key wajib.', { fields: { 'Idempotency-Key': ['Wajib.'] } })
    if (getScenario() === 'locked') return fail('LOCKED', 'Barang ini sedang diproses oleh sistem lain.')
    forcedInvalid({ quantity: 'Jumlah tidak diterima server.', reason: 'Alasan tidak diterima server.' })
    return one(adjustmentResult, adjustStock(await json(request), actor, key), 201)
  }),
  route('get', '/stock/movements', ({ request }) =>
    paged(stockMovement, db.listMovements(query(request)), request),
  ),

  route('get', '/reservations', ({ request }) =>
    paged(reservation, db.listReservations(query(request)), request),
  ),
  route('get', '/area-access', ({ request }) =>
    paged(areaAccess, db.listAreaAccess(query(request)), request),
  ),
  route('get', '/logs', ({ request }) => paged(logEntry, db.listLogs(query(request)), request)),
]
