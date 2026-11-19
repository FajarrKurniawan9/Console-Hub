import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ApiError, request, tokenStore } from '../../src/lib/api/client'
import { item, many, one, person, production, trackingResult } from '../../src/lib/api/schemas'
import { itemId, personId, productionId, store } from '../data/logistics'
import { setScenario } from '../scenarios'

// The mock hub, tested through the real client: every response must pass the client's zod schemas.

const as = (who: 'admin' | 'user') => tokenStore.set(`mock-${who === 'admin' ? 1 : 2}-test`)
const fails = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as ApiError,
  )

describe('fixtures', () => {
  it('12 people (1 inactive), 6 productions (1 inactive, 1 without courier), 15 items', () => {
    expect(store.people).toHaveLength(12)
    expect(store.people.filter((p) => p.status === 'nonaktif')).toHaveLength(1)
    expect(store.productions).toHaveLength(6)
    expect(store.productions.filter((p) => p.status === 'nonaktif')).toHaveLength(1)
    expect(store.productions.some((p) => p.status === 'aktif' && !p.courier_id)).toBe(true)
    expect(store.items).toHaveLength(15)
    expect(store.items.some((i) => !i.production_id)).toBe(true)
    expect(store.items.some((i) => !i.responsible_id)).toBe(true)
  })
})

describe('reads merge the three sources', () => {
  it('items list carries production and responsible refs, active only by default', async () => {
    as('user')
    const page = await request(many(item), { url: '/items', params: { limit: 100 } })
    expect(page.data).toHaveLength(14)
    const kain = page.data.find((i) => i.name === 'Kain katun')!
    expect(kain.production).toEqual({
      id: productionId(1),
      area: 'Area Tekstil A',
      production_type: 'Tenun',
    })
    expect(kain.responsible?.name).toBe('Joko Susilo')
    expect(page.meta.unavailable).toBeUndefined()
  })

  it('filters by q, kind, status=all, and pages with a cursor', async () => {
    as('user')
    const besi = await request(many(item), { url: '/items', params: { kind: 'besi' } })
    expect(besi.data.map((i) => i.name).sort()).toEqual(
      ['Besi beton 10 mm', 'Pipa besi 1 inci', 'Plat besi 2 mm'].sort(),
    )
    const all = await request(many(item), { url: '/items', params: { status: 'all', limit: 10 } })
    expect(all.data).toHaveLength(10)
    const next = await request(many(item), {
      url: '/items',
      params: { status: 'all', limit: 10, cursor: all.meta.next_cursor },
    })
    expect(next.data).toHaveLength(5)
    expect(next.meta.next_cursor).toBeNull()
  })

  it('hr-down: merged people are null and meta.unavailable lists hr', async () => {
    setScenario('hr-down')
    as('user')
    const page = await request(many(item), { url: '/items' })
    expect(page.meta.unavailable).toEqual(['hr'])
    expect(page.data.every((i) => i.responsible === null)).toBe(true)
    expect(page.data.find((i) => i.name === 'Kain katun')!.production).not.toBeNull()
    const prods = await request(many(production), { url: '/productions' })
    expect(prods.data.every((p) => p.courier === null)).toBe(true)
    const e = await fails(request(many(person), { url: '/people' }))
    expect(e).toMatchObject({ code: 'SOURCE_UNREACHABLE', status: 502 })
  })

  it('gudang-down: items 502, productions and people still work', async () => {
    setScenario('gudang-down')
    as('user')
    expect(await fails(request(many(item), { url: '/items' }))).toMatchObject({
      code: 'SOURCE_UNREACHABLE',
    })
    await expect(request(many(production), { url: '/productions' })).resolves.toBeTruthy()
    await expect(request(many(person), { url: '/people' })).resolves.toBeTruthy()
  })

  it('User gets a plain message, Admin the source name', async () => {
    setScenario('gudang-down')
    as('user')
    const u = await fails(request(many(item), { url: '/items' }))
    expect(u!.message).not.toMatch(/Gudang|API|ECONNREFUSED/)
    as('admin')
    const a = await fails(request(many(item), { url: '/items' }))
    expect(a!.message).toMatch(/Gudang/)
  })
})

describe('writes', () => {
  it('creates an item (version 1) and merges its references', async () => {
    as('user')
    const r = await request(one(item), {
      url: '/items',
      method: 'POST',
      data: {
        name: 'Kain linen',
        kind: 'kain',
        production_id: productionId(1),
        responsible_id: personId(2),
        quantity: 80,
        unit: 'm',
      },
    })
    expect(r.data).toMatchObject({
      version: 1,
      status: 'aktif',
      responsible: { name: 'Joko Susilo' },
    })
  })

  it('422 REFERENCE_NOT_FOUND for an inactive person, with the field name', async () => {
    as('user')
    const e = await fails(
      request(one(item), {
        url: '/items',
        method: 'POST',
        data: { name: 'Kain linen', kind: 'kain', responsible_id: personId(12) },
      }),
    )
    expect(e).toMatchObject({ code: 'REFERENCE_NOT_FOUND', status: 422 })
    expect(e!.fields).toHaveProperty('responsible_id')
  })

  it('422 VALIDATION_ERROR with messages per field', async () => {
    as('admin') // User has no personel.create
    const e = await fails(
      request(one(person), { url: '/people', method: 'POST', data: { name: 'A' } }),
    )
    expect(e).toMatchObject({ code: 'VALIDATION_ERROR', status: 422 })
    expect(Object.keys(e!.fields).sort()).toEqual(['name', 'role'])
  })

  it('PATCH bumps the version; a stale expected_version is 409 VERSION_CONFLICT', async () => {
    as('user')
    const id = itemId(1)
    const v = store.items.find((i) => i.id === id)!.version
    const r = await request(one(item), {
      url: `/items/${id}`,
      method: 'PATCH',
      data: { quantity: 1, expected_version: v },
    })
    expect(r.data).toMatchObject({ quantity: 1, version: v + 1 })
    const e = await fails(
      request(one(item), {
        url: `/items/${id}`,
        method: 'PATCH',
        data: { quantity: 2, expected_version: v },
      }),
    )
    expect(e).toMatchObject({ code: 'VERSION_CONFLICT', status: 409 })
  })

  it('production area + type must be unique among active rows', async () => {
    as('user')
    const e = await fails(
      request(one(production), {
        url: '/productions',
        method: 'POST',
        data: { area: 'Area Tekstil A', production_type: 'Tenun' },
      }),
    )
    expect(e!.fields).toHaveProperty('production_type')
  })

  it('DELETE needs ?expected_version; 409 REFERENCED lists users for Admin only', async () => {
    as('admin')
    const kurir = personId(6) // courier of two productions
    const e = await fails(
      request(one(person), {
        url: `/people/${kurir}?expected_version=${store.people[5]!.version}`,
        method: 'DELETE',
      }),
    )
    expect(e).toMatchObject({ code: 'REFERENCED', status: 409 })
    expect((e!.details?.used_by as unknown[]).length).toBe(2)
  })

  it('User never receives used_by', async () => {
    as('user')
    const p = store.productions[0]! // used by items; User may not delete productions → 403
    const e = await fails(
      request(one(production), {
        url: `/productions/${p.id}?expected_version=${p.version}`,
        method: 'DELETE',
      }),
    )
    expect(e).toMatchObject({ code: 'FORBIDDEN' })
  })

  it('deactivates an unused person', async () => {
    as('admin')
    const p = store.people[10]! // Hendra, referenced by nothing
    const r = await request(one(person), {
      url: `/people/${p.id}?expected_version=${p.version}`,
      method: 'DELETE',
    })
    expect(r.data).toMatchObject({ status: 'nonaktif', version: p.version })
  })

  it('writes to Personel are 502 while HR is down; items stay writable without HR refs', async () => {
    setScenario('hr-down')
    as('admin')
    expect(
      await fails(
        request(one(person), {
          url: '/people',
          method: 'POST',
          data: { name: 'Lina', role: 'Kurir' },
        }),
      ),
    ).toMatchObject({ code: 'SOURCE_UNREACHABLE' })
    await expect(
      request(one(item), {
        url: '/items',
        method: 'POST',
        data: { name: 'Kain linen', kind: 'kain' },
      }),
    ).resolves.toBeTruthy()
  })

  it('scenarios conflict and referenced refuse every PATCH / DELETE', async () => {
    as('admin')
    const i = store.items[0]!
    setScenario('conflict')
    expect(
      await fails(
        request(one(item), {
          url: `/items/${i.id}`,
          method: 'PATCH',
          data: { quantity: 3, expected_version: i.version },
        }),
      ),
    ).toMatchObject({ code: 'VERSION_CONFLICT' })
    setScenario('referenced')
    expect(
      await fails(
        request(one(item), {
          url: `/items/${i.id}?expected_version=${i.version}`,
          method: 'DELETE',
        }),
      ),
    ).toMatchObject({ code: 'REFERENCED' })
  })
})

describe('GET /tracking/items/{id}', () => {
  const track = (id: string) => request(one(trackingResult), { url: `/tracking/items/${id}` })

  it('merges item, production (with courier), responsible; sources only for Admin', async () => {
    as('admin')
    const { data } = await track(itemId(1))
    expect(data.item.name).toBe('Kain katun')
    expect(data.production?.area).toBe('Area Tekstil A')
    expect(data.responsible?.name).toBe('Joko Susilo')
    expect(data.courier?.name).toBe('Dedi Kurniawan')
    expect(data.warnings).toEqual([])
    expect(data.sources?.map((s) => s.source)).toEqual(['gudang', 'produksi', 'hr'])
    for (const s of data.sources!) {
      expect(s.status).toBe('ok')
      expect(s.latency_ms).toBeGreaterThanOrEqual(40)
      expect(s.latency_ms).toBeLessThanOrEqual(300)
    }
    as('user')
    expect((await track(itemId(1))).data.sources).toBeUndefined()
  })

  it('hr-down: item and production stay, people null, plain warning', async () => {
    setScenario('hr-down')
    as('admin')
    const { data } = await track(itemId(1))
    expect(data.item.name).toBe('Kain katun')
    expect(data.production?.area).toBe('Area Tekstil A')
    expect(data.responsible).toBeNull()
    expect(data.courier).toBeNull()
    expect(data.warnings).toContain('Data personel sedang tidak tersedia.')
    expect(data.sources?.find((s) => s.source === 'hr')).toEqual({
      source: 'hr',
      status: 'unavailable',
      latency_ms: null,
    })
  })

  it('all-down: 502, Gudang owns the item', async () => {
    setScenario('all-down')
    as('user')
    expect(await fails(track(itemId(1)))).toMatchObject({ code: 'SOURCE_UNREACHABLE' })
  })

  it('unknown id is 404', async () => {
    as('user')
    expect(await fails(track('nope'))).toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('schemas', () => {
  it('every list response passes the client schema', async () => {
    as('admin')
    for (const [url, s] of [
      ['/items', item],
      ['/productions', production],
      ['/people', person],
    ] as const)
      await expect(
        request(many(s as z.ZodType), { url, params: { status: 'all' } }),
      ).resolves.toBeTruthy()
  })
})
