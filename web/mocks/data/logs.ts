import type { LogEntry, LogLevel } from '../../src/lib/api/schemas'
import { getScenario } from '../scenarios'
import { consoleSeeds, DOWN_SINCE, isDown } from './consoles'
import { PEOPLE, username } from './people'
import { seeded } from './random'

type Slug = 'hr' | 'gudang' | 'produksi'
type Template = (r: ReturnType<typeof seeded>) => {
  message: string
  actor: string | null
  event: string
}

const person = (r: ReturnType<typeof seeded>) => username(r.pick(PEOPLE))
const ITEM_NAMES = ['Kain katun', 'Besi beton 10 mm', 'Buku tulis 58 lembar', 'Sarden kaleng 425 g']
const AREAS = ['Area Tekstil A', 'Area Logam B', 'Area Percetakan', 'Area Pangan']

const TEMPLATES: Record<Slug, Record<'info' | 'warn' | 'error', Template[]>> = {
  hr: {
    info: [
      (r) => ({ message: 'Personel baru ditambahkan', actor: person(r), event: 'person.created' }),
      (r) => ({
        message: `Role personel diubah menjadi ${r.pick(['Kurir', 'Staf Gudang', 'Operator Produksi'])}`,
        actor: person(r),
        event: 'person.updated',
      }),
      (r) => ({ message: `Daftar personel dibaca (${r.int(2, 25)} ID)`, actor: 'hub', event: 'person.listed' }),
    ],
    warn: [
      () => ({ message: 'Kunci layanan salah pada permintaan dari 10.0.4.12', actor: null, event: 'auth.failed' }),
      (r) => ({ message: `Batas permintaan hampir tercapai (${r.int(50, 59)}/60 per menit)`, actor: 'hub', event: 'rate.near' }),
    ],
    error: [
      () => ({ message: 'Koneksi database terputus (SSL SYSCALL error: EOF detected)', actor: null, event: 'db.lost' }),
    ],
  },
  gudang: {
    info: [
      (r) => ({ message: `Barang "${r.pick(ITEM_NAMES)}" ditambahkan`, actor: person(r), event: 'item.created' }),
      (r) => ({
        message: `Jumlah "${r.pick(ITEM_NAMES)}" diubah menjadi ${r.int(5, 400)}`,
        actor: person(r),
        event: 'item.updated',
      }),
      (r) => ({ message: `Daftar barang dibaca (${r.int(5, 25)} baris)`, actor: 'hub', event: 'item.listed' }),
    ],
    warn: [
      (r) => ({
        message: `Permintaan PATCH ditolak: VERSION_CONFLICT (versi ${r.int(2, 6)})`,
        actor: person(r),
        event: 'item.conflict',
      }),
    ],
    error: [
      () => ({ message: 'Query daftar barang melebihi batas waktu 5 dtk', actor: null, event: 'db.timeout' }),
    ],
  },
  produksi: {
    info: [
      (r) => ({ message: `Produksi ${r.pick(AREAS)} diperbarui`, actor: person(r), event: 'production.updated' }),
      (r) => ({ message: `Pengantar produksi ${r.pick(AREAS)} diganti`, actor: person(r), event: 'production.courier' }),
      (r) => ({ message: `Daftar produksi dibaca (${r.int(2, 6)} ID)`, actor: 'hub', event: 'production.listed' }),
    ],
    warn: [
      (r) => ({
        message: `Permintaan POST ditolak: DUPLICATE (${r.pick(AREAS)} sudah punya jenis itu)`,
        actor: person(r),
        event: 'production.duplicate',
      }),
    ],
    error: [
      () => ({ message: 'Gagal menulis app_logs: disk penuh', actor: null, event: 'log.failed' }),
    ],
  },
}

/** Each console logs in its own format; the portal normalizes it, `raw` keeps the original. */
function rawFor(
  slug: Slug,
  level: LogLevel,
  at: string,
  t: ReturnType<Template>,
  seq: number,
): unknown {
  if (slug === 'hr') return { event: t.event, level, by: t.actor, ts: at, message: t.message }
  if (slug === 'gudang')
    return {
      line: `${at} ${level.toUpperCase().padEnd(5)} [${t.event.split('.')[0]}] ${t.message}`,
      source: 'syslog',
    }
  return {
    severity: { info: 'INFO', warn: 'WARNING', error: 'ERROR', debug: 'DEBUG' }[level],
    component: t.event.split('.')[0],
    msg: t.message,
    request_id: `req-${(seq * 7919).toString(16)}`,
    timestamp: at,
  }
}

const r = seeded(20261117)
const START = Date.now()
const logs: LogEntry[] = []

function pushLog(slug: Slug, at: number, rand = r) {
  const roll = rand.next()
  const level: 'info' | 'warn' | 'error' = roll < 0.7 ? 'info' : roll < 0.9 ? 'warn' : 'error'
  const t = rand.pick(TEMPLATES[slug][level])(rand)
  const c = consoleSeeds.find((x) => x.slug === slug)!
  const id = logs.length + 1
  const iso = new Date(at).toISOString()
  logs.push({
    id,
    console: { id: c.id, slug: c.slug, name: c.name },
    occurred_at: iso,
    level,
    message: t.message,
    actor: t.actor,
    raw: rawFor(slug, level, iso, t, id),
  })
}

// 420 entries over 7 days, denser in the last 24 hours. Ascending time = ascending id.
const SLUGS: Slug[] = ['hr', 'gudang', 'produksi']
const times = Array.from({ length: 420 }, (_, i) =>
  i < 150 ? START - r.next() * 86_400_000 : START - 86_400_000 - r.next() * 6 * 86_400_000,
).sort((a, b) => a - b)
for (const at of times) pushLog(r.pick(SLUGS), at)

/** Visible logs for the current scenario: a dead console stops logging at the moment it died. */
export function visibleLogs(): LogEntry[] {
  const s = getScenario()
  if (s === 'empty') return []
  const cut = new Date(DOWN_SINCE).getTime()
  return logs.filter((l) => !(isDown(l.console.slug as Slug) && new Date(l.occurred_at).getTime() > cut))
}

/** Pull new logs from live consoles. Returns how many arrived per console. */
export function addLogs(slug: Slug, count: number) {
  const live = seeded(Date.now() % 100000)
  for (let i = 0; i < count; i++) pushLog(slug, Date.now(), live)
}

export const findLog = (id: number) => visibleLogs().find((l) => l.id === id)

/** Browser only: new logs every 20–30 s so the "log baru" marker can be tried. */
export function startLogTicker() {
  const tick = () => {
    const live = SLUGS.filter((s) => !isDown(s) && getScenario() !== 'empty')
    if (live.length)
      addLogs(live[Math.floor(Math.random() * live.length)]!, 1 + Math.floor(Math.random() * 2))
    setTimeout(tick, 20_000 + Math.random() * 10_000)
  }
  setTimeout(tick, 20_000 + Math.random() * 10_000)
}
