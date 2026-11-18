import { CircleAlert, CircleCheck, PlugZap } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ErrorState } from '../../../components/ErrorState'
import { DetailShell, PageHeader, Panel } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { ConsoleStatusDot } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import { describeError } from '../../../lib/errors'
import { duration } from '../../../lib/format'
import { CONSOLE_STATUS } from '../../../lib/status'
import { downSince, useConsole, useTestConsole } from './queries'

export function ConsoleDetailPage() {
  const id = Number(useParams().id)
  const q = useConsole(id)
  const test = useTestConsole(id)

  if (q.isPending)
    return (
      <DetailShell title="Console" backTo="/console" backLabel="Semua console">
        <RowsSkeleton rows={6} label="Memuat console" />
      </DetailShell>
    )
  if (q.isError)
    return (
      <DetailShell title="Console" backTo="/console" backLabel="Semua console">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      </DetailShell>
    )
  const c = q.data
  const since = downSince(c)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={c.name}
        meta={
          <Link to="/console" className="hover:text-fg">
            ← Semua console
          </Link>
        }
        actions={
          <Button onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? <Spinner /> : <PlugZap size={16} strokeWidth={1.5} aria-hidden />}
            {test.isPending ? 'Menguji…' : 'Uji koneksi'}
          </Button>
        }
      />

      {test.isSuccess ? (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-dense ${test.data.status === 'down' ? 'border-error' : test.data.status === 'slow' ? 'border-warn' : 'border-ok'}`}
        >
          {test.data.status === 'ok' ? (
            <CircleCheck
              size={16}
              strokeWidth={1.5}
              className="mt-px shrink-0 text-ok"
              aria-hidden
            />
          ) : (
            <CircleAlert
              size={16}
              strokeWidth={1.5}
              className="mt-px shrink-0 text-error"
              aria-hidden
            />
          )}
          <span>
            <span className="font-semibold">
              Hasil uji: {CONSOLE_STATUS[test.data.status].label}.
            </span>{' '}
            {test.data.message}
          </span>
        </p>
      ) : test.isError ? (
        <p role="alert" className="rounded-md border border-error px-3 py-2 text-dense">
          Uji koneksi gagal dijalankan: {describeError(test.error, true).title}.{' '}
          {describeError(test.error, true).next}
        </p>
      ) : null}

      {c.status === 'down' ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-error px-3 py-2 text-dense"
        >
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            className="mt-px shrink-0 text-error"
            aria-hidden
          />
          <span>
            Tidak dapat dihubungi
            {since ? (
              <>
                {' '}
                sejak <TimeText iso={since} />
              </>
            ) : null}
            . Pesan terakhir: <span className="font-mono">{c.last_error}</span>. Semua penulisan
            data akan ditolak dan log console ini tertinggal sampai console pulih.
          </span>
        </p>
      ) : null}

      <Panel className="p-4">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 text-dense">
          <dt className="text-muted">Status</dt>
          <dd>
            <ConsoleStatusDot status={c.status} />
          </dd>
          <dt className="text-muted">Latensi terakhir</dt>
          <dd className="font-mono">
            {c.last_latency_ms !== null ? duration(c.last_latency_ms) : '—'}
          </dd>
          <dt className="text-muted">Pemeriksaan terakhir</dt>
          <dd>{c.last_checked_at ? <TimeText iso={c.last_checked_at} /> : 'Belum pernah'}</dd>
          <dt className="text-muted">Alamat</dt>
          <dd className="font-mono">{c.base_url}</dd>
          <dt className="text-muted">Error terakhir</dt>
          <dd className="font-mono">{c.last_error ?? '—'}</dd>
          <dt className="text-muted">Slug</dt>
          <dd className="font-mono">{c.slug}</dd>
        </dl>
      </Panel>

      <Link
        to={`/log?console=${c.id}`}
        className="self-start text-dense text-accent underline-offset-4 hover:underline"
      >
        Lihat log {c.name}
      </Link>
    </div>
  )
}
