import clsx from 'clsx'
import { CircleAlert, CircleX, RotateCcw, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState } from '../../components/ErrorState'
import { DetailShell, PageHeader, Panel, Section } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { RunStatusDot } from '../../components/StatusDot'
import { TimeText } from '../../components/TimeText'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { describeError } from '../../lib/errors'
import { runDuration } from '../../lib/format'
import { canCancel, isFinalStatus, retryMode } from '../../lib/runs'
import type { Run } from '../../lib/schemas'
import { useConsoles } from '../consoles/queries'
import { useCancelRun, useRetryRun, useRun } from './queries'
import { StepList } from './StepList'
import { StepStrip } from './StepStrip'

export function RunDetailPage() {
  const id = useParams().id!
  const q = useRun(id)
  const [selected, setSelected] = useState<number | null>(null)

  if (q.isPending)
    return (
      <DetailShell title="Eksekusi" backTo="/runs" backLabel="Semua eksekusi">
        <RowsSkeleton rows={8} label="Memuat eksekusi" />
      </DetailShell>
    )
  if (q.isError && !q.data)
    return (
      <DetailShell title="Eksekusi" backTo="/runs" backLabel="Semua eksekusi">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      </DetailShell>
    )
  const run = q.data!
  return (
    <div className="flex flex-col gap-6">
      <RunHeader run={run} />
      {q.isError ? (
        <p role="status" className="rounded-md border border-warn px-3 py-2 text-dense">
          Pembaruan status gagal ({describeError(q.error).title}). Tampilan di bawah mungkin
          tertinggal; mencoba lagi otomatis.
        </p>
      ) : null}
      <Section title="Langkah">
        <StepStrip steps={run.steps ?? []} selected={selected} onSelect={setSelected} />
        <StepList run={run} selected={selected} onSelect={setSelected} />
      </Section>
    </div>
  )
}

function RunHeader({ run }: { run: Run }) {
  const navigate = useNavigate()
  const cancel = useCancelRun(run.id)
  const retry = useRetryRun(run.id)
  const consoles = useConsoles()
  const mode = retryMode(run)
  const final = isFinalStatus(run.status)
  // Re-render every second so the running duration ticks between polls.
  const [, tick] = useState(0)
  useEffect(() => {
    if (final) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [final])

  const onActionError = (err: unknown) => {
    const d = describeError(err, (slug) => consoles.data?.find((c) => c.slug === slug)?.name)
    toast.error(`${d.title}. ${d.message}`)
  }

  const inputEntries = Object.entries(run.input)
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={run.process.name}
        meta={
          <span className="flex flex-wrap items-center gap-x-3">
            <Link to="/runs" className="hover:text-fg">
              ← Semua eksekusi
            </Link>
            <span className="font-mono">{run.id}</span>
            {run.retry_of ? (
              <span>
                ulangan dari{' '}
                <Link
                  to={`/runs/${run.retry_of}`}
                  className="font-mono text-accent hover:underline"
                >
                  {run.retry_of}
                </Link>
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            {canCancel(run) ? (
              <Button
                variant="danger"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(undefined, { onError: onActionError })}
              >
                {cancel.isPending ? (
                  <Spinner />
                ) : (
                  <CircleX size={16} strokeWidth={1.5} aria-hidden />
                )}
                Batalkan
              </Button>
            ) : null}
            {mode ? (
              <Button
                variant="primary"
                disabled={retry.isPending}
                onClick={() =>
                  retry.mutate(undefined, {
                    onSuccess: (r) => navigate(`/runs/${r.id}`),
                    onError: onActionError,
                  })
                }
              >
                {retry.isPending ? (
                  <Spinner />
                ) : mode === 'from_failed' ? (
                  <RotateCcw size={16} strokeWidth={1.5} aria-hidden />
                ) : (
                  <RefreshCw size={16} strokeWidth={1.5} aria-hidden />
                )}
                {mode === 'from_failed' ? 'Ulangi dari langkah gagal' : 'Jalankan ulang dari awal'}
              </Button>
            ) : null}
          </>
        }
      />
      <Panel className="p-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-dense sm:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted">Status</dt>
            <dd>
              <RunStatusDot status={run.status} />
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted">Mulai</dt>
            <dd>
              {run.started_at ? (
                <TimeText iso={run.started_at} />
              ) : (
                <span className="text-muted">menunggu antrean</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted">Durasi</dt>
            <dd className="font-mono">{runDuration(run.started_at, run.finished_at) ?? '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted">Pemicu</dt>
            <dd>{run.triggered_by.name}</dd>
          </div>
          <div className="col-span-full flex flex-col gap-0.5">
            <dt className="text-xs text-muted">Input</dt>
            <dd className="font-mono text-dense break-all">
              {inputEntries.length
                ? inputEntries
                    .map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v}"` : String(v)}`)
                    .join('  ')
                : '—'}
            </dd>
          </div>
        </dl>
      </Panel>
      {run.error_summary ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-error px-3 py-2 text-dense"
        >
          <CircleAlert
            size={16}
            strokeWidth={1.5}
            className="mt-px shrink-0 text-error"
            aria-hidden
          />
          <span>
            {run.error_summary.replace(/\.?$/, '.')}
            {mode === 'from_start'
              ? ' Langkah sebelumnya sudah dibatalkan (kompensasi), jadi ulangan dimulai dari awal.'
              : mode === 'from_failed'
                ? ' Langkah yang sudah berhasil tidak diulang.'
                : ''}
          </span>
        </p>
      ) : null}
      {!final ? (
        <p className={clsx('text-xs text-muted')} aria-live="polite">
          Memperbarui otomatis tiap 2 detik sampai selesai.
        </p>
      ) : null}
    </div>
  )
}
