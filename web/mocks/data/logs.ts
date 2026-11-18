import type { LogEntry, LogLevel } from '../../src/lib/api/schemas'
import { getScenario } from '../scenarios'
import { consoleSeeds, DOWN_SINCE, isDown } from './consoles'
import { PEOPLE, username } from './people'
import { pad, seeded } from './random'

type Slug = 'hr' | 'gudang' | 'produksi'
type Template = (r: ReturnType<typeof seeded>) => {
  message: string
  actor: string | null
  event: string
}

const rp = (n: number) => `Rp${n.toLocaleString('id-ID')}`
const person = (r: ReturnType<typeof seeded>) => username(r.pick(PEOPLE))

const TEMPLATES: Record<Slug, Record<'info' | 'warn' | 'error', Template[]>> = {
  hr: {
    info: [
      (r) => ({
        message: `Karyawan E-${pad(r.int(13, 40))} dibuat`,
        actor: person(r),
        event: 'employee.created',
      }),
      (r) => ({
        message: `Data karyawan E-${pad(r.int(1, 12))} diperbarui`,
        actor: person(r),
        event: 'employee.updated',
      }),
      (r) => ({
        message: `Hak akses "${r.pick(['Operator gudang', 'Supervisor produksi', 'Staf HR'])}" diberikan ke E-${pad(r.int(1, 12))}`,
        actor: person(r),
        event: 'access.granted',
      }),
      (r) => ({
        message: `Karyawan E-${pad(r.int(1, 12))} dipindahkan ke divisi ${r.pick(['Produksi', 'Gudang', 'Keuangan'])}`,
        actor: person(r),
        event: 'employee.moved',
      }),
    ],
    warn: [
      (r) => ({
        message: `Login gagal 3 kali untuk akun ${person(r)}`,
        actor: null,
        event: 'auth.failed',
      }),
      (r) => ({
        message: `Kontrak karyawan E-${pad(r.int(1, 12))} berakhir dalam 7 hari`,
        actor: null,
        event: 'contract.expiring',
      }),
    ],
    error: [
      () => ({
        message: 'Sinkronisasi divisi gagal: direktori LDAP tidak merespons (timeout 10 dtk)',
        actor: null,
        event: 'sync.failed',
      }),
      (r) => ({
        message: `Gagal mengirim email aktivasi ke E-${pad(r.int(13, 40))}: SMTP 550`,
        actor: null,
        event: 'mail.failed',
      }),
    ],
  },
  gudang: {
    info: [
      (r) => ({
        message: `Reservasi RSV-2026-${pad(r.int(100, 400), 4)} dibuat untuk PO-2026-${pad(r.int(1, 60), 4)}`,
        actor: 'sistem',
        event: 'reservation.created',
      }),
      (r) => ({
        message: `Barang masuk SKU-BB-${pad(r.int(1, 8))} sebanyak ${r.int(5, 40) * 10} kg`,
        actor: person(r),
        event: 'stock.in',
      }),
      (r) => ({
        message: `Barang keluar SKU-BJ-${pad(r.int(1, 7))} sebanyak ${r.int(2, 30)} karton`,
        actor: person(r),
        event: 'stock.out',
      }),
      (r) => ({
        message: `Akses area Gudang ${r.pick(['A', 'B', 'C'])} diberikan ke E-${pad(r.int(1, 12))}`,
        actor: 'sistem',
        event: 'area.granted',
      }),
    ],
    warn: [
      (r) => ({
        message: `Stok SKU-BB-${pad(r.int(1, 8))} di bawah minimum (sisa ${r.int(2, 40)} kg, minimum 50 kg)`,
        actor: 'sistem',
        event: 'stock.low',
      }),
      (r) => ({
        message: `Akses area Gudang ${r.pick(['A', 'B'])} ditolak untuk E-${pad(r.int(1, 12))}`,
        actor: null,
        event: 'area.denied',
      }),
      (r) => ({
        message: `Reservasi RSV-2026-${pad(r.int(100, 400), 4)} dibatalkan`,
        actor: 'sistem',
        event: 'reservation.canceled',
      }),
    ],
    error: [
      () => ({
        message: 'Gagal menulis mutasi stok: deadlock terdeteksi pada tabel stock_moves',
        actor: null,
        event: 'db.deadlock',
      }),
      (r) => ({
        message: `Reservasi untuk PO-2026-${pad(r.int(1, 60), 4)} ditolak: stok SKU-BB-${pad(r.int(1, 8))} tidak cukup`,
        actor: 'sistem',
        event: 'reservation.rejected',
      }),
    ],
  },
  produksi: {
    info: [
      (r) => ({
        message: `Pesanan PO-2026-${pad(r.int(1, 60), 4)} masuk antrean (posisi ${r.int(1, 9)})`,
        actor: 'sistem',
        event: 'queue.added',
      }),
      (r) => {
        const old = r.int(10, 30) * 5000
        return {
          message: `Harga SKU-BJ-${pad(r.int(1, 6))} diubah dari ${rp(old)} menjadi ${rp(old + 10000)}`,
          actor: person(r),
          event: 'price.updated',
        }
      },
      (r) => ({
        message: `Pengiriman DO-2026-${pad(r.int(1, 300), 4)} berangkat`,
        actor: person(r),
        event: 'shipment.departed',
      }),
      (r) => ({
        message: `Pesanan PO-2026-${pad(r.int(1, 60), 4)} selesai diproduksi`,
        actor: 'sistem',
        event: 'order.finished',
      }),
    ],
    warn: [
      (r) => ({
        message: `Pesanan PO-2026-${pad(r.int(1, 60), 4)} terlambat ${r.int(1, 5)} jam dari jadwal`,
        actor: 'sistem',
        event: 'order.late',
      }),
      () => ({
        message: 'Tim shift malam kurang 1 operator',
        actor: 'sistem',
        event: 'shift.understaffed',
      }),
    ],
    error: [
      (r) => ({
        message: `Mesin LINE-${r.int(1, 4)} berhenti: sensor suhu di luar batas`,
        actor: null,
        event: 'machine.stopped',
      }),
      (r) => ({
        message: `Pengiriman DO-2026-${pad(r.int(1, 300), 4)} gagal dijadwalkan: armada tidak tersedia`,
        actor: null,
        event: 'shipment.failed',
      }),
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
    // Linked to real mock transactions in phase 3.
    tx_id: null,
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
  return logs.filter((l) => !(isDown(l.console.slug) && new Date(l.occurred_at).getTime() > cut))
}

/** A log line written by a console while it takes part in a transaction. */
export function logTx(
  slug: Slug,
  level: LogLevel,
  message: string,
  actor: string | null,
  txId: string,
) {
  const c = consoleSeeds.find((x) => x.slug === slug)!
  const id = logs.length + 1
  const iso = new Date().toISOString()
  logs.push({
    id,
    console: { id: c.id, slug: c.slug, name: c.name },
    occurred_at: iso,
    level,
    message,
    actor,
    tx_id: txId,
    raw: rawFor(slug, level, iso, { message, actor, event: 'tx.participant' }, id),
  })
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
