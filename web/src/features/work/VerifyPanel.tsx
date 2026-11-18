import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { RowsSkeleton } from '../../components/Skeletons'
import { Dot } from '../../components/StatusDot'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { Spinner } from '../../components/ui/Spinner'
import type { VerifyResult } from '../../lib/api/schemas'
import { getOne, type Resource } from '../../lib/api/work'
import { useCan } from '../../lib/permissions'
import type { Tone } from '../../lib/status'

const STATUS: Record<VerifyResult['consoles'][number]['status'], { label: string; tone: Tone }> = {
  match: { label: 'Sama', tone: 'ok' },
  missing: { label: 'Hilang', tone: 'error' },
  version_mismatch: { label: 'Versi berbeda', tone: 'error' },
  checksum_mismatch: { label: 'Isi berbeda', tone: 'error' },
  unreachable: { label: 'Tidak terjangkau', tone: 'warn' },
}

/** "Sama di 3 console" or "Berbeda di Gudang", with the version per console. */
export function SyncBadge({ result }: { result: VerifyResult }) {
  if (result.in_sync) return <Dot tone="ok" label={`Sama di ${result.consoles.length} console`} />
  const off = result.consoles.filter((c) => c.status !== 'match')
  const unreachableOnly = off.every((c) => c.status === 'unreachable')
  return (
    <Dot
      tone={unreachableOnly ? 'warn' : 'error'}
      label={`${unreachableOnly ? 'Tidak dapat dicek di' : 'Berbeda di'} ${off.map((c) => c.console.name).join(', ')}`}
      className="font-semibold"
    />
  )
}

/** Admin side panel for a work row: fields plus `?verify=all` across the three consoles. */
export function VerifyPanel({
  resource,
  id,
  title,
  fields,
  onClose,
}: {
  resource: Resource
  id: string | null
  title: string
  fields: [string, React.ReactNode][]
  onClose: () => void
}) {
  const can = useCan()
  return (
    <Sheet
      open={id !== null}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description="Detail data"
    >
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-dense">
          {fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {id && can('admin.consistency.view') ? <CheckAll resource={resource} id={id} /> : null}
      </div>
    </Sheet>
  )
}

/** "Cek di 3 console": `GET /{sumber}/{id}?verify=all` on demand, one column per console. */
function CheckAll({ resource, id }: { resource: Resource; id: string }) {
  const q = useQuery({
    queryKey: ['work', resource, 'verify', id],
    queryFn: () => getOne(resource, id, true),
    enabled: false,
    staleTime: 0,
  })
  const asked = q.fetchStatus === 'fetching' || q.isFetched || q.isError
  return (
    <section aria-label="Cek di 3 console" aria-live="polite" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Konsistensi</h3>
        <Button onClick={() => void q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? <Spinner /> : null}
          {q.isFetching ? 'Mengecek…' : asked ? 'Cek ulang' : 'Cek di 3 console'}
        </Button>
      </div>
      {!asked ? (
        <p className="text-dense text-muted">
          Bandingkan versi dan checksum data ini di HR, Gudang, dan Produksi.
        </p>
      ) : q.isPending ? (
        <RowsSkeleton rows={3} label="Mengecek di 3 console" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      ) : !q.data.consistency ? (
        <p className="text-dense text-muted">Backend tidak mengirim hasil verifikasi.</p>
      ) : (
        <VerifyColumns result={q.data.consistency} />
      )}
    </section>
  )
}

const short = (sum: string | null | undefined) => (sum ? sum.slice(0, 8) : '—')

export function VerifyColumns({ result }: { result: VerifyResult }) {
  const owner = result.consoles.find((c) => c.status === 'match')
  return (
    <>
      <SyncBadge result={result} />
      <div className="grid grid-cols-3 gap-2 text-dense">
        {result.consoles.map((c) => {
          const off = c.status !== 'match'
          const sumDiffers = !!owner?.checksum && !!c.checksum && c.checksum !== owner.checksum
          return (
            <div
              key={c.console.slug}
              className={`flex flex-col gap-1 rounded-md border px-2.5 py-2 ${off ? (c.status === 'unreachable' ? 'border-warn' : 'border-error') : ''}`}
            >
              <span className="font-semibold">{c.console.name}</span>
              <Dot {...STATUS[c.status]} />
              <span className="flex justify-between gap-2 text-xs">
                <span className="text-muted">versi</span>
                <span className="font-mono">{c.version !== null ? `v${c.version}` : '—'}</span>
              </span>
              <span className="flex justify-between gap-2 text-xs">
                <span className="text-muted">checksum</span>
                <span
                  className={`font-mono ${sumDiffers ? 'font-semibold text-error' : ''}`}
                  title={c.checksum ?? undefined}
                >
                  {short(c.checksum)}
                </span>
              </span>
            </div>
          )
        })}
      </div>
      {!result.in_sync ? (
        <Link
          to="/konsistensi"
          className="self-start text-dense text-accent underline-offset-4 hover:underline"
        >
          Periksa dan perbaiki di halaman Konsistensi
        </Link>
      ) : null}
    </>
  )
}
