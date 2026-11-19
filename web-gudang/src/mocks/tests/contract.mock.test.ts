// Setiap endpoint mock dibaca lewat klien sungguhan + skema Zod yang sama dengan UI.
import { describe, expect, it } from 'vitest'
import { ApiError, request, tokenStore } from '../../lib/api/client'
import * as s from '../../lib/api/schemas'
import { db } from '../engine/state'
import { setScenario } from '../scenarios'

const login = () => tokenStore.set('mock-1-test')

describe('kontrak mock', () => {
  it('semua endpoint baca lolos skema', async () => {
    login()
    const anItem = db.listItems({})[0]!
    const aRack = db.listRacks({})[0]!
    const checks = await Promise.all([
      request(s.dataOf(s.uiUser), '/auth/me'),
      request(s.dataOf(s.dashboard), '/dashboard'),
      request(s.pagedOf(s.item), '/items'),
      request(s.dataOf(s.itemDetail), `/items/${anItem.id}`),
      request(s.pagedOf(s.rack), '/racks'),
      request(s.dataOf(s.rack), `/racks/${aRack.id}`),
      request(s.pagedOf(s.stockLine), '/stock'),
      request(s.pagedOf(s.stockMovement), '/stock/movements'),
      request(s.pagedOf(s.reservation), '/reservations'),
      request(s.pagedOf(s.areaAccess), '/area-access'),
      request(s.pagedOf(s.logEntry), '/logs'),
    ])
    expect(checks).toHaveLength(11)
  })

  it('jumlah fixture sesuai brief', async () => {
    login()
    const items = (await request(s.pagedOf(s.item), '/items')).data
    expect(items).toHaveLength(15)
    expect(items.filter((i) => i.kind === 'BB')).toHaveLength(8)
    expect(items.filter((i) => i.locked)).toHaveLength(1)
    expect(items.filter((i) => i.stock.available === 0)).toHaveLength(1)
    const racks = (await request(s.pagedOf(s.rack), '/racks')).data
    expect(racks.map((r) => r.code)).toEqual(['RAK-A1', 'RAK-A2', 'RAK-B1', 'RAK-B2', 'RAK-C1', 'RAK-COLD'])
    expect(racks.filter((r) => r.status === 'nonaktif')).toHaveLength(1)
    expect((await request(s.pagedOf(s.stockLine), '/stock')).data).toHaveLength(30)
    expect((await request(s.pagedOf(s.stockMovement), '/stock/movements')).data.length).toBeGreaterThanOrEqual(40)
    const res = (await request(s.pagedOf(s.reservation), '/reservations')).data
    expect(res).toHaveLength(8)
    expect(new Set(res.map((r) => r.status))).toEqual(new Set(['aktif', 'dilepas', 'dipakai']))
    expect((await request(s.pagedOf(s.areaAccess), '/area-access')).data).toHaveLength(10)
    expect((await request(s.pagedOf(s.logEntry), '/logs')).data.length).toBe(50) // halaman pertama
    expect(db.listLogs({}).length).toBeGreaterThanOrEqual(60)
  })

  it('stok tiap barang = jumlah semua rak, tersedia = ada − direservasi', () => {
    for (const it of db.listItems({})) {
      const lines = db.listStock({ item_id: it.id })
      expect(it.stock.on_hand).toBe(lines.reduce((a, l) => a + l.on_hand, 0))
      expect(it.stock.reserved).toBe(lines.reduce((a, l) => a + l.reserved, 0))
      expect(it.stock.available).toBe(it.stock.on_hand - it.stock.reserved)
    }
  })

  it('tanpa token → 401 UNAUTHENTICATED dengan envelope galat', async () => {
    setScenario('ok')
    await expect(request(s.dataOf(s.dashboard), '/dashboard')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    })
  })

  it('skenario server-error → ApiError SERVER_ERROR', async () => {
    login()
    setScenario('server-error')
    const err = await request(s.pagedOf(s.item), '/items').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('SERVER_ERROR')
  })
})
