import { delay, http } from 'msw'
import type { z } from 'zod'
import { item, many, one, person, production, trackingResult } from '../../src/lib/api/schemas'
import { recordAudit } from '../data/audit'
import { can, type MockUser } from '../data/users'
import {
  create,
  deactivate,
  getOne,
  HubError,
  list,
  OWNER,
  touchesSlow,
  track,
  update,
  type Ctx,
  type Kind,
} from '../engine/hub'
import { fail, guard, latency, ok, url } from '../http'
import { mockConfig } from '../scenarios'

const SCHEMA = { items: item, productions: production, people: person } as const
const PERM = { items: 'barang', productions: 'produksi', people: 'personel' } as const
const body = async (r: Request) => (await r.json().catch(() => ({}))) as Record<string, unknown>
const ctxOf = (u: MockUser): Ctx => ({ admin: can(u, 'admin.consoles.view') })

/** Every mock response goes through the client's own schema, so the mock cannot drift. */
function checked<S extends z.ZodType>(schema: S, value: unknown, status = 200) {
  return ok(schema.parse(value) as never, status)
}

/** `slow-source`: requests that touch the slow source wait 3 s. */
async function slowWait(kind: Kind | 'tracking') {
  if (!mockConfig.instant && touchesSlow(kind)) await delay(3000)
}

function run(fn: () => Response) {
  try {
    return fn()
  } catch (e) {
    if (e instanceof HubError)
      return fail(e.code, e.message, e.details ? { details: e.details } : {})
    throw e
  }
}

const label = (row: Record<string, unknown>) =>
  String(row.name ?? `${row.area} · ${row.production_type}`)

function resource(kind: Kind) {
  const path = `/${kind}`
  const perm = PERM[kind]
  const schema = SCHEMA[kind]
  return [
    http.get(url(path), async ({ request }) => {
      await latency()
      const g = guard(request, `${perm}.view`)
      if (g.error) return g.error
      await slowWait(kind)
      return run(() =>
        checked(many(schema), list(kind, new URL(request.url).searchParams, ctxOf(g.user))),
      )
    }),

    http.get(url(`${path}/:id`), async ({ request, params }) => {
      await latency()
      const g = guard(request, `${perm}.view`)
      if (g.error) return g.error
      await slowWait(kind)
      return run(() =>
        checked(one(schema), { data: getOne(kind, String(params.id), ctxOf(g.user)) }),
      )
    }),

    http.post(url(path), async ({ request }) => {
      await latency()
      const g = guard(request, `${perm}.create`)
      if (g.error) return g.error
      const b = await body(request)
      return run(() => {
        const r = create(kind, b, ctxOf(g.user))
        recordAudit(g.user, `${perm}.create`, { type: kind, id: r.row.id }, OWNER[kind], {
          name: label(r.row),
        })
        return checked(one(schema), { data: r.view }, 201)
      })
    }),

    http.patch(url(`${path}/:id`), async ({ request, params }) => {
      await latency()
      const g = guard(request, `${perm}.update`)
      if (g.error) return g.error
      const b = await body(request)
      return run(() => {
        const r = update(kind, String(params.id), b, ctxOf(g.user))
        recordAudit(g.user, `${perm}.update`, { type: kind, id: r.row.id }, OWNER[kind], {
          name: label(r.row),
          changes: r.changes,
        })
        return checked(one(schema), { data: r.view })
      })
    }),

    http.delete(url(`${path}/:id`), async ({ request, params }) => {
      await latency()
      const g = guard(request, `${perm}.delete`)
      if (g.error) return g.error
      const expected = new URL(request.url).searchParams.get('expected_version')
      return run(() => {
        const r = deactivate(kind, String(params.id), expected, ctxOf(g.user))
        recordAudit(g.user, `${perm}.delete`, { type: kind, id: r.row.id }, OWNER[kind], {
          name: label(r.row),
        })
        return checked(one(schema), { data: r.view })
      })
    }),
  ]
}

export const workHandlers = [
  ...resource('items'),
  ...resource('productions'),
  ...resource('people'),

  http.get(url('/tracking/items/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'lacak.view')
    if (g.error) return g.error
    await slowWait('tracking')
    const ctx = ctxOf(g.user)
    return run(() =>
      checked(one(trackingResult), {
        data: track(String(params.id), { ...ctx, sources: ctx.admin }),
      }),
    )
  }),
]
