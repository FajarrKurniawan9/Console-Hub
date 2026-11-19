// Dev stand-in for the three source APIs (kontrak-3-api-console-hub-v1.md §1-4) until the real ones are ready.
// One process = one API:  STUB_SOURCE=hr|gudang|produksi  STUB_PORT=9101  STUB_KEY=...  [STUB_DEV=true]
// No dependencies: Node 20+ only.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCES = {
  hr: { resource: 'people', port: 9101 },
  gudang: { resource: 'items', port: 9102 },
  produksi: { resource: 'productions', port: 9103 },
}

const source = process.env.STUB_SOURCE
if (!SOURCES[source]) {
  console.error('STUB_SOURCE harus hr, gudang, atau produksi.')
  process.exit(1)
}
const { resource } = SOURCES[source]
const port = Number(process.env.STUB_PORT ?? SOURCES[source].port)
const key = process.env.STUB_KEY ?? ''
const dev = process.env.STUB_DEV === 'true'
if (key.length < 8) {
  console.error('STUB_KEY wajib diisi (minimal 8 karakter).')
  process.exit(1)
}

// ---- storage: memory, persisted to .stub-data/<source>.json

const file = join(dirname(fileURLToPath(import.meta.url)), '.stub-data', `${source}.json`)
let state = { rows: [], logs: [], logSeq: 0 }
try {
  state = JSON.parse(readFileSync(file, 'utf8'))
} catch {
  // First run: start empty (the hub fills it with `php artisan hub:seed-demo`).
}
const save = () => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(state, null, 2))
}

let fault = { mode: 'none', ms: 0 }

// ---- per-resource fields (contract §2-4)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (min, max) => (v) =>
  typeof v === 'string' && v.trim().length >= min && v.trim().length <= max
    ? null
    : `Wajib teks ${min}-${max} karakter.`
const ref = (v) => (v === null || (typeof v === 'string' && UUID.test(v)) ? null : 'Harus UUID atau null.')

const SPEC = {
  people: {
    fields: { name: text(2, 120), role: text(2, 60) },
    required: ['name', 'role'],
    filters: ['role'],
    search: ['name'],
  },
  productions: {
    fields: { area: text(2, 80), production_type: text(2, 80), courier_id: ref },
    required: ['area', 'production_type'],
    filters: ['production_type', 'courier_id'],
    search: ['area', 'production_type'],
    defaults: { courier_id: null },
  },
  items: {
    fields: {
      name: text(2, 120),
      kind: text(2, 60),
      production_id: ref,
      responsible_id: ref,
      quantity: (v) => (Number.isInteger(v) && v >= 0 ? null : 'Harus bilangan bulat >= 0.'),
      unit: text(1, 20),
    },
    required: ['name', 'kind'],
    filters: ['kind', 'production_id', 'responsible_id'],
    search: ['name'],
    defaults: { production_id: null, responsible_id: null, quantity: 0, unit: 'pcs' },
  },
}[resource]

// ---- helpers

const json = (res, status, body, requestId) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'X-Request-Id': requestId })
  res.end(JSON.stringify(body))
}
const fail = (code, message, details = {}) => ({ code, message, details })
const STATUS = { UNAUTHENTICATED: 401, NOT_FOUND: 404, VALIDATION_ERROR: 422, VERSION_CONFLICT: 409, DUPLICATE: 409 }

function log(level, message, actor, requestId) {
  state.logs.push({
    id: ++state.logSeq,
    occurred_at: new Date().toISOString(),
    level,
    message,
    actor: actor || null,
    request_id: requestId,
  })
  if (state.logs.length > 2000) state.logs.splice(0, state.logs.length - 2000)
}

function validate(body, creating) {
  const fields = {}
  for (const [name, check] of Object.entries(SPEC.fields)) {
    if (!(name in body)) {
      if (creating && SPEC.required.includes(name)) fields[name] = ['Wajib diisi.']
      continue
    }
    const problem = check(body[name])
    if (problem) fields[name] = [problem]
  }
  if (creating && 'id' in body && !(typeof body.id === 'string' && UUID.test(body.id)))
    fields.id = ['Harus UUID.']
  if (!creating && !Number.isInteger(body.expected_version))
    fields.expected_version = ['Wajib bilangan bulat.']
  if (Object.keys(fields).length) throw fail('VALIDATION_ERROR', 'Input tidak valid.', { fields })
}

function assertNoDuplicate(row, selfId) {
  if (resource !== 'productions') return
  const same = state.rows.find(
    (r) =>
      r.id !== selfId &&
      r.status === 'aktif' &&
      r.area.toLowerCase() === row.area.toLowerCase() &&
      r.production_type.toLowerCase() === row.production_type.toLowerCase(),
  )
  if (same) throw fail('DUPLICATE', 'Area ini sudah punya produksi dengan jenis yang sama.')
}

function checkVersion(row, expected) {
  if (expected !== row.version)
    throw fail('VERSION_CONFLICT', 'Versi data sudah berubah.', { current_version: row.version })
}

const cursorOf = (row) => Buffer.from(`${row.created_at}|${row.id}`).toString('base64url')
const after = (cursor) => {
  const [createdAt, id] = Buffer.from(cursor, 'base64url').toString().split('|')
  return (r) => r.created_at < createdAt || (r.created_at === createdAt && r.id < id)
}
const newestFirst = (a, b) => (a.created_at === b.created_at ? (a.id < b.id ? 1 : -1) : a.created_at < b.created_at ? 1 : -1)

function list(q) {
  const ids = q.get('ids') ? q.get('ids').split(',').slice(0, 100) : null
  const status = q.get('status') ?? (ids ? 'all' : 'aktif')
  const limit = Math.min(Math.max(Number(q.get('limit') ?? 25) || 25, 1), 100)
  const search = (q.get('q') ?? '').toLowerCase()
  let rows = state.rows.filter(
    (r) =>
      (!ids || ids.includes(r.id)) &&
      (status === 'all' || r.status === status) &&
      SPEC.filters.every((f) => !q.has(f) || r[f] === q.get(f)) &&
      (!search || SPEC.search.some((f) => r[f].toLowerCase().includes(search))),
  )
  rows.sort(newestFirst)
  if (q.get('cursor')) rows = rows.filter(after(q.get('cursor')))
  const page = rows.slice(0, limit)
  return { data: page, meta: { next_cursor: rows.length > limit ? cursorOf(page.at(-1)) : null } }
}

function logs(q) {
  const since = q.get('since') ?? ''
  const fromId = Number(q.get('cursor') ?? 0)
  const limit = Math.min(Number(q.get('limit') ?? 100) || 100, 500)
  const rows = state.logs.filter((l) => l.id > fromId && l.occurred_at >= since)
  const page = rows.slice(0, limit)
  return {
    data: page.map(({ id, occurred_at, level, message, actor }) => ({ id, occurred_at, level, message, actor })),
    meta: { next_cursor: rows.length > limit ? String(page.at(-1).id) : null },
  }
}

// ---- routing

async function handle(method, url, body, actor, requestId) {
  const path = url.pathname
  const base = `/api/v1/${resource}`

  if (path === `${base}` && method === 'GET') return [200, list(url.searchParams)]
  if (path === '/api/v1/logs' && method === 'GET') return [200, logs(url.searchParams)]

  if (path === base && method === 'POST') {
    validate(body, true)
    const now = new Date().toISOString()
    const id = body.id ?? randomUUID()
    if (state.rows.some((r) => r.id === id)) throw fail('DUPLICATE', 'ID sudah dipakai.')
    const row = { id, ...SPEC.defaults }
    for (const f of Object.keys(SPEC.fields)) if (f in body) row[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
    Object.assign(row, { status: 'aktif', version: 1, created_at: now, updated_at: now })
    assertNoDuplicate(row)
    state.rows.push(row)
    log('info', `${resource} dibuat: ${row.id}`, actor, requestId)
    return [201, { data: row }]
  }

  const id = path.startsWith(`${base}/`) ? decodeURIComponent(path.slice(base.length + 1)) : null
  if (id === null || id.includes('/')) throw fail('NOT_FOUND', 'Endpoint tidak ditemukan.')
  const row = state.rows.find((r) => r.id === id)
  if (!row) throw fail('NOT_FOUND', 'Data tidak ditemukan.')

  if (method === 'GET') return [200, { data: row }]

  if (method === 'PATCH') {
    validate(body, false)
    checkVersion(row, body.expected_version)
    const next = { ...row }
    for (const f of Object.keys(SPEC.fields)) if (f in body) next[f] = typeof body[f] === 'string' ? body[f].trim() : body[f]
    assertNoDuplicate(next, row.id)
    Object.assign(row, next, { version: row.version + 1, updated_at: new Date().toISOString() })
    log('info', `${resource} diubah: ${row.id}`, actor, requestId)
    return [200, { data: row }]
  }

  if (method === 'DELETE') {
    const expected = Number(url.searchParams.get('expected_version'))
    if (!Number.isInteger(expected) || expected < 1)
      throw fail('VALIDATION_ERROR', 'Input tidak valid.', { fields: { expected_version: ['Wajib di query string.'] } })
    checkVersion(row, expected)
    Object.assign(row, { status: 'nonaktif', version: row.version + 1, updated_at: new Date().toISOString() })
    log('info', `${resource} dinonaktifkan: ${row.id}`, actor, requestId)
    return [200, { data: row }]
  }

  throw fail('NOT_FOUND', 'Endpoint tidak ditemukan.')
}

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve(null)
      }
    })
  })

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://stub')
  const requestId = req.headers['x-request-id'] || randomUUID()
  const method = req.method

  // Dev-only controls: no key, never in a real API.
  if (dev && url.pathname.startsWith('/dev/') && method === 'POST') {
    const body = (await readBody(req)) ?? {}
    if (url.pathname === '/dev/fault' && ['none', 'down', 'slow', 'error500'].includes(body.mode)) {
      fault = { mode: body.mode, ms: Number(body.ms ?? 3000) }
      return json(res, 200, { data: fault }, requestId)
    }
    if (url.pathname === '/dev/reset') {
      state = { rows: [], logs: [], logSeq: 0 }
      fault = { mode: 'none', ms: 0 }
      save()
      return json(res, 200, { data: { reset: true } }, requestId)
    }
    return json(res, 404, { error: fail('NOT_FOUND', 'Endpoint dev tidak ditemukan.') }, requestId)
  }

  if (fault.mode === 'down') return req.socket.destroy()
  if (fault.mode === 'slow') await new Promise((r) => setTimeout(r, fault.ms))

  if (url.pathname === '/health' && method === 'GET') return json(res, 200, { status: 'ok' }, requestId)

  if (req.headers['x-service-key'] !== key)
    return json(res, 401, { error: fail('UNAUTHENTICATED', 'Kunci layanan salah atau hilang.') }, requestId)

  if (fault.mode === 'error500') {
    log('error', 'Kesalahan buatan (dev/fault error500).', req.headers['x-acting-user'], requestId)
    return json(res, 500, { error: fail('SERVER_ERROR', 'Kesalahan server.') }, requestId)
  }

  const body = ['POST', 'PATCH'].includes(method) ? await readBody(req) : {}
  if (body === null)
    return json(res, 422, { error: fail('VALIDATION_ERROR', 'Body bukan JSON.', { fields: {} }) }, requestId)

  try {
    const [status, payload] = await handle(method, url, body, req.headers['x-acting-user'], requestId)
    if (method !== 'GET') save()
    json(res, status, payload, requestId)
  } catch (e) {
    if (!e?.code) {
      log('error', `Kesalahan tak terduga: ${e?.message ?? e}`, req.headers['x-acting-user'], requestId)
      return json(res, 500, { error: fail('SERVER_ERROR', 'Kesalahan server.') }, requestId)
    }
    if (e.code !== 'NOT_FOUND') log('warn', `${method} ${url.pathname}: ${e.code}`, req.headers['x-acting-user'], requestId)
    json(res, STATUS[e.code] ?? 500, { error: e }, requestId)
  }
}).listen(port, '127.0.0.1', () => console.log(`console-stub ${source} (${resource}) di http://127.0.0.1:${port}${dev ? ' [dev]' : ''}`))
