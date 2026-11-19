const TZ = 'Asia/Jakarta'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: 'numeric',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ISO UTC → `dd MMM yyyy HH:mm` waktu Jakarta. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]))
  return `${p.day} ${MONTHS[Number(p.month) - 1]} ${p.year} ${p.hour}:${p.minute}`
}

const nf = new Intl.NumberFormat('id-ID')
export const formatNumber = (n: number) => nf.format(n)

/** Jumlah bertanda: +12 / −5 / 0. */
export const formatSigned = (n: number) => (n > 0 ? `+${nf.format(n)}` : n < 0 ? `−${nf.format(-n)}` : '0')

/** Tanggal `yyyy-mm-dd` dari input → batas hari waktu Jakarta dalam ISO UTC. */
export const dayStartIso = (d: string) => (d ? new Date(`${d}T00:00:00+07:00`).toISOString() : undefined)
export const dayEndIso = (d: string) => (d ? new Date(`${d}T23:59:59.999+07:00`).toISOString() : undefined)
