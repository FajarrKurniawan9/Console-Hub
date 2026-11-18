import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { ErrorState } from '../../../components/ErrorState'
import { JsonView } from '../../../components/JsonView'
import { DetailShell, PageHeader, Panel, Section } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { Dot, TxStateBadge } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { Button } from '../../../components/ui/Button'
import { FINAL_TX_STATES, type Transaction } from '../../../lib/api/schemas'
import { describeError } from '../../../lib/errors'
import { duration } from '../../../lib/format'
import { useCan } from '../../../lib/permissions'
import { DECISION, decisionVerb, opLabel, PREPARE, txDuration } from './labels'
import { ParticipantStrip } from './ParticipantStrip'
import { useConsoles } from '../consoles/queries'
import { useResolve, useTransaction } from './queries'

export function TransactionDetailPage() {
  const id = useParams().id!
  const q = useTransaction(id)
  const consoles = useConsoles()
  // Participants carry the slug; the log filter wants the console id.
  const consoleId = (slug: string) => consoles.data?.find((c) => c.slug === slug)?.id ?? ''

  if (q.isPending)
    return (
      <DetailShell title={`Transaksi ${id}`} backTo="/transaksi" backLabel="Semua transaksi">
        <RowsSkeleton rows={6} label="Memuat transaksi" />
      </DetailShell>
    )
  if (q.isError)
    return (
      <DetailShell title={`Transaksi ${id}`} backTo="/transaksi" backLabel="Semua transaksi">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      </DetailShell>
    )
  const t = q.data
  const live = !FINAL_TX_STATES.includes(t.state)
  const ms = txDuration(t)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={opLabel(t.operation)}
        meta={
          <Link to="/transaksi" className="hover:text-fg">
            ← Semua transaksi
          </Link>
        }
      />

      <Panel className="p-4">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-dense sm:grid-cols-[max-content_1fr_max-content_1fr]">
          <dt className="text-muted">Status</dt>
          <dd className="flex items-center gap-2">
            <TxStateBadge state={t.state} />
            {live ? <span className="text-xs text-muted">diperbarui tiap 2 detik</span> : null}
          </dd>
          <dt className="text-muted">ID</dt>
          <dd className="font-mono">{t.id}</dd>
          <dt className="text-muted">Operasi</dt>
          <dd className="font-mono">{t.operation}</dd>
          <dt className="text-muted">Data</dt>
          <dd className="font-mono">
            {t.entity_type ? `${t.entity_type} ${t.entity_id ?? ''}` : '—'}
          </dd>
          <dt className="text-muted">Pemicu</dt>
          <dd>{t.requested_by.name}</dd>
          <dt className="text-muted">Durasi</dt>
          <dd className="font-mono">{ms !== null ? duration(ms) : 'berjalan'}</dd>
        </dl>
        {t.failure_message ? (
          <p className="mt-3 flex items-start gap-2 border-t pt-3 text-dense">
            <CircleAlert
              size={16}
              strokeWidth={1.5}
              className="mt-px shrink-0 text-error"
              aria-hidden
            />
            <span>
              {t.failure_code ? (
                <span className="font-mono text-xs text-error">{t.failure_code} · </span>
              ) : null}
              {t.failure_message}
            </span>
          </p>
        ) : null}
      </Panel>

      {t.state === 'needs_attention' ? <Resolve tx={t} /> : null}

      <Section title="Fase per console">
        <ParticipantStrip tx={t} />
      </Section>

      <Section title="Detail per console">
        <Panel>
          <ul className="divide-y">
            {t.participants.map((p) => (
              <li key={p.console.slug} className="flex flex-col gap-2 px-4 py-3 text-dense">
                <span className="font-semibold">{p.console.name}</span>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5">
                  <dt className="text-muted">Jawaban prepare</dt>
                  <dd>
                    <Dot {...PREPARE[p.prepare_state]} />
                    {p.prepared_at ? (
                      <span className="ml-2 text-muted">
                        <TimeText iso={p.prepared_at} />
                      </span>
                    ) : null}
                  </dd>
                  {p.refusal_code ? (
                    <>
                      <dt className="text-muted">Penolakan</dt>
                      <dd>
                        <span className="font-mono text-xs text-error">{p.refusal_code}</span>{' '}
                        {p.refusal_message}
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted">{decisionVerb(t)}</dt>
                  <dd>
                    <Dot {...DECISION[p.decision_state]} />
                    {p.finished_at ? (
                      <span className="ml-2 text-muted">
                        <TimeText iso={p.finished_at} />
                      </span>
                    ) : null}
                  </dd>
                  <dt className="text-muted">Percobaan</dt>
                  <dd className="font-mono">{p.attempts}</dd>
                  <dt className="text-muted">Error terakhir</dt>
                  <dd className="font-mono break-all">{p.last_error ?? '—'}</dd>
                </dl>
                <Link
                  to={`/log?console=${consoleId(p.console.slug)}&q=${t.id}&range=7d`}
                  className="self-start text-accent underline-offset-4 hover:underline"
                >
                  Log {p.console.name} untuk transaksi ini
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </Section>

      <Section title="Garis waktu">
        <Timeline tx={t} />
      </Section>

      {t.payload !== undefined ? (
        <Section title="Payload">
          <JsonView value={t.payload} label={`Payload ${t.operation}`} />
        </Section>
      ) : null}
    </div>
  )
}

function Timeline({ tx }: { tx: Transaction }) {
  const prepared = tx.participants
    .map((p) => p.prepared_at)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1)
  const steps: [string, string | null | undefined][] = [
    ['Dibuat', tx.created_at],
    ['Prepare selesai', prepared],
    ['Keputusan diambil', tx.decided_at],
    ['Selesai', tx.finished_at],
  ]
  return (
    <ol className="flex flex-col gap-1.5 text-dense">
      {steps.map(([label, at]) => (
        <li key={label} className="flex items-center gap-3">
          <span
            aria-hidden
            className={`size-2 shrink-0 rounded-full ${at ? 'bg-accent' : 'border border-muted'}`}
          />
          <span className="w-36 shrink-0">{label}</span>
          <span className="text-muted">{at ? <TimeText iso={at} /> : 'belum'}</span>
        </li>
      ))}
    </ol>
  )
}

const RESOLVE = {
  retry_commit: {
    label: 'Coba commit ulang',
    title: 'Coba commit ulang?',
    body: 'Portal akan mengirim ulang perintah commit ke console yang gagal. Console yang sudah commit tidak disentuh. Bila console masih bermasalah, transaksi tetap berstatus Perlu tindakan.',
  },
  abort: {
    label: 'Batalkan transaksi',
    title: 'Batalkan transaksi?',
    body: 'Perubahan dibatalkan di semua console, termasuk console yang sudah commit. Data kembali seperti sebelum transaksi. Tindakan ini tidak dapat diurungkan.',
  },
} as const

function Resolve({ tx }: { tx: Transaction }) {
  const can = useCan()
  const resolve = useResolve(tx.id)
  const [action, setAction] = useState<keyof typeof RESOLVE | null>(null)
  const failed = tx.participants
    .filter((p) => p.decision_state === 'failed')
    .map((p) => p.console.name)
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-md border border-error p-4">
      <p className="text-dense">
        <span className="font-semibold">Transaksi ini perlu diselesaikan.</span> Keputusan commit
        sudah diambil, tetapi {failed.join(', ') || 'satu console'} belum menerapkannya. Data di
        console bisa berbeda sampai ini diselesaikan.
      </p>
      {can('admin.transactions.resolve') ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setAction('retry_commit')}>
            {RESOLVE.retry_commit.label}
          </Button>
          <Button variant="danger" onClick={() => setAction('abort')}>
            {RESOLVE.abort.label}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Peran Anda tidak memiliki izin admin.transactions.resolve.
        </p>
      )}
      {resolve.isError ? (
        <p className="text-dense text-error">
          {describeError(resolve.error, true).title}: {resolve.error.message}
        </p>
      ) : null}
      {action ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAction(null)}
          title={RESOLVE[action].title}
          description={`${tx.id} · ${opLabel(tx.operation)}`}
          confirmLabel={RESOLVE[action].label}
          busyLabel="Mengirim…"
          danger={action === 'abort'}
          busy={resolve.isPending}
          onConfirm={() => resolve.mutate(action, { onSettled: () => setAction(null) })}
        >
          <p>{RESOLVE[action].body}</p>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
