import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ErrorState } from '../../components/ErrorState'
import { RowsSkeleton } from '../../components/Skeletons'
import { Dot } from '../../components/StatusDot'
import { Sheet } from '../../components/ui/Sheet'
import type { VerifyResult } from '../../lib/api/schemas'
import { getOne, type Resource } from '../../lib/api/work'
import type { Tone } from '../../lib/status'

const STATUS: Record<VerifyResult['consoles'][number]['status'], { label: string; tone: Tone }> = {
  match: { label: 'Sama', tone: 'ok' },
  missing: { label: 'Hilang', tone: 'error' },
  version_mismatch: { label: 'Versi berbeda', tone: 'error' },
  checksum_mismatch: { label: 'Isi berbeda', tone: 'error' },
  unreachable: { label: 'Tidak terjangkau', tone: 'warn' },
}

/** "Sinkron di 3 console" or "Berbeda di Gudang", with the version per console. */
export function SyncBadge({ result }: { result: VerifyResult }) {
  if (result.in_sync)
    return <Dot tone="ok" label={`Sinkron di ${result.consoles.length} console`} />
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
  const q = useQuery({
    queryKey: ['work', resource, 'verify', id],
    queryFn: () => getOne(resource, id!, true),
    enabled: id !== null,
    staleTime: 0,
  })
  return (
    <Sheet
      open={id !== null}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description="Diverifikasi di tiga console"
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
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">Konsistensi</h3>
          {q.isPending ? (
            <RowsSkeleton rows={3} label="Memverifikasi" />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
          ) : !q.data.consistency ? (
            <p className="text-dense text-muted">Backend tidak mengirim hasil verifikasi.</p>
          ) : (
            <>
              <SyncBadge result={q.data.consistency} />
              <ul className="divide-y rounded-md border text-dense">
                {q.data.consistency.consoles.map((c) => (
                  <li key={c.console.slug} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-24 font-semibold">{c.console.name}</span>
                    <span className="flex-1">
                      <Dot {...STATUS[c.status]} />
                    </span>
                    <span className="font-mono text-muted">
                      {c.version !== null ? `v${c.version}` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
              {!q.data.consistency.in_sync ? (
                <Link
                  to="/konsistensi"
                  className="text-dense text-accent underline-offset-4 hover:underline"
                >
                  Periksa dan perbaiki di halaman Konsistensi
                </Link>
              ) : null}
            </>
          )}
        </section>
      </div>
    </Sheet>
  )
}
