// Contract check against a running hub (update 1 §12 "Kontrak"): every response the screens read is
// parsed with the zod schemas they use. Skipped unless HUB_URL is set:
//   HUB_URL=http://127.0.0.1:8000/api/v1 HUB_ADMIN_EMAIL=… HUB_ADMIN_PASSWORD=… HUB_USER_EMAIL=… HUB_USER_PASSWORD=… \
//     npx vitest run --config vitest.hub.config.ts
// The hub must hold the demo data (`php artisan hub:seed-demo`) with all three sources up.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  apiErrorBody,
  auditEvent,
  authUser,
  consoleInfo,
  consoleTest,
  item,
  logEntry,
  logSyncResult,
  loginResult,
  many,
  one,
  overview,
  person,
  production,
  rbacRole,
  rbacUser,
  trackingResult,
} from './schemas'

const HUB = import.meta.env.HUB_URL as string | undefined
const env = (k: string) => (import.meta.env[k] as string | undefined) ?? ''

async function call(token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${HUB}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: res.status === 204 ? null : await res.json() }
}

/** Parse with the frontend schema; on failure show the zod issues, not just "false". */
function expectShape(schema: z.ZodType, json: unknown) {
  const parsed = schema.safeParse(json)
  expect(parsed.success ? 'ok' : z.prettifyError(parsed.error)).toBe('ok')
}

async function login(email: string, password: string) {
  const { status, json } = await call(null, 'POST', '/auth/login', { email, password })
  expect(status).toBe(200)
  expectShape(one(loginResult), json)
  return json.data.token as string
}

describe.skipIf(!HUB)('hub contract (live)', () => {
  it('matches every schema the screens read', async () => {
    const admin = await login(env('HUB_ADMIN_EMAIL'), env('HUB_ADMIN_PASSWORD'))
    const get = async (schema: z.ZodType, path: string) => {
      const r = await call(admin, 'GET', path)
      expect(r.status, path).toBe(200)
      expectShape(schema, r.json)
      return r.json
    }

    await get(one(authUser), '/auth/me')
    const items = await get(many(item), '/items')
    await get(many(production), '/productions')
    const people = await get(many(person), '/people')
    await get(one(item), `/items/${items.data[0].id}`)
    await get(one(person), `/people/${people.data[0].id}`)
    const tracked = await get(one(trackingResult), `/tracking/items/${items.data[0].id}`)
    expect(tracked.data.sources).toHaveLength(3)

    const consoles = await get(many(consoleInfo), '/admin/consoles')
    await get(one(consoleInfo), `/admin/consoles/${consoles.data[0].id}`)
    const test = await call(admin, 'POST', `/admin/consoles/${consoles.data[0].id}/test`)
    expectShape(one(consoleTest), test.json)
    const sync = await call(admin, 'POST', '/admin/logs/sync', {})
    expectShape(one(logSyncResult), sync.json)
    const logs = await get(many(logEntry), '/admin/logs')
    if (logs.data.length) await get(one(logEntry), `/admin/logs/${logs.data[0].id}`)
    await get(one(overview), '/admin/overview')
    await get(many(auditEvent), '/admin/audit')
    await get(many(rbacUser), '/admin/rbac/users')
    await get(many(rbacRole), '/admin/rbac/roles')
    await get(many(z.string()), '/admin/rbac/permissions')
  })

  it('writes and refuses in the shapes useWrite expects', async () => {
    const admin = await login(env('HUB_ADMIN_EMAIL'), env('HUB_ADMIN_PASSWORD'))

    const created = await call(admin, 'POST', '/people', { name: 'Uji Kontrak', role: 'Kurir' })
    expect(created.status).toBe(201)
    expectShape(one(person), created.json)
    const p = created.json.data

    const updated = await call(admin, 'PATCH', `/people/${p.id}`, {
      role: 'Staf Gudang',
      expected_version: 1,
    })
    expectShape(one(person), updated.json)

    const conflict = await call(admin, 'PATCH', `/people/${p.id}`, {
      role: 'Kurir',
      expected_version: 1,
    })
    expect([conflict.status, conflict.json.error.code]).toEqual([409, 'VERSION_CONFLICT'])
    expectShape(apiErrorBody, conflict.json)

    const badRef = await call(admin, 'POST', '/items', {
      name: 'Uji',
      kind: 'uji',
      responsible_id: '00000000-0000-4000-8000-000000000000',
    })
    expect([badRef.status, badRef.json.error.code]).toEqual([422, 'REFERENCE_NOT_FOUND'])
    expectShape(apiErrorBody, badRef.json)
    expect(badRef.json.error.details.fields).toHaveProperty('responsible_id')

    const invalid = await call(admin, 'POST', '/people', { name: 'A' })
    expect(invalid.json.error.code).toBe('VALIDATION_ERROR')
    expectShape(apiErrorBody, invalid.json)

    const items = (await call(admin, 'GET', '/items?limit=100')).json.data as z.infer<typeof item>[]
    const used = items.find((i) => i.responsible_id)!
    const refused = await call(admin, 'DELETE', `/people/${used.responsible_id}?expected_version=1`)
    expect([refused.status, refused.json.error.code]).toEqual([409, 'REFERENCED'])
    expectShape(apiErrorBody, refused.json)

    const deactivated = await call(admin, 'DELETE', `/people/${p.id}?expected_version=2`)
    expectShape(one(person), deactivated.json)
    expect(deactivated.json.data.status).toBe('nonaktif')
  })

  it('keeps User out of admin data', async () => {
    const user = await login(env('HUB_USER_EMAIL'), env('HUB_USER_PASSWORD'))

    const me = await call(user, 'GET', '/auth/me')
    expect(me.json.data.permissions.some((p: string) => p.startsWith('admin.'))).toBe(false)
    for (const path of [
      '/admin/overview',
      '/admin/consoles',
      '/admin/logs',
      '/admin/audit',
      '/admin/rbac/users',
    ]) {
      const r = await call(user, 'GET', path)
      expect([path, r.status, r.json.error.code]).toEqual([path, 403, 'FORBIDDEN'])
    }

    const items = (await call(user, 'GET', '/items')).json.data
    const tracked = await call(user, 'GET', `/tracking/items/${items[0].id}`)
    expectShape(one(trackingResult), tracked.json)
    expect(tracked.json.data).not.toHaveProperty('sources')
  })
})
