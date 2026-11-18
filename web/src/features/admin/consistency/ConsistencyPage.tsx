import { ScanSearch } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { Dot } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { Button } from '../../../components/ui/Button'
import { Select } from '../../../components/ui/Select'
import { Spinner } from '../../../components/ui/Spinner'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import type { ConsistencyCheck, ConsistencyFinding } from '../../../lib/api/schemas'
import { describeError } from '../../../lib/errors'
import { duration } from '../../../lib/format'
import { useCan } from '../../../lib/permissions'
import { useUrlState } from '../../../lib/useUrlState'
import { CHECK_STATUS, ENTITY, KIND } from './labels'
import { useCheck, useChecks, useRepair, useRunCheck } from './queries'

export function ConsistencyPage() {
  const url = useUrlState()
  const can = useCan()
  const checks = useChecks()
  const run = useRunCheck()
  const [entity, setEntity] = useState<ConsistencyCheck['entity_type']>('barang')
  const selected = url.get('check') ? Number(url.get('check')) : null
  const busy = checks.data?.some((c) => c.entity_type === entity && c.status === 'running')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Konsistensi data"
        meta="Membandingkan salinan Divisi, Karyawan, dan Barang di tiga console dengan data pemiliknya."
      />

      {can('admin.consistency.repair') ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-dense">
            <span className="font-semibold">Entitas</span>
            <Select value={entity} onChange={(e) => setEntity(e.target.value as typeof entity)}>
              {Object.entries(ENTITY).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <Button
            variant="primary"
            disabled={run.isPending || busy}
            onClick={() =>
              run.mutate(entity, { onSuccess: (c) => url.set({ check: String(c.id) }) })
            }
          >
            {run.isPending || busy ? (
              <Spinner />
            ) : (
              <ScanSearch size={16} strokeWidth={1.5} aria-hidden />
            )}
            {busy ? 'Sedang memeriksa…' : 'Periksa sekarang'}
          </Button>
          {run.isError ? (
            <p role="alert" className="text-dense text-error">
              {describeError(run.error, true).title}: {run.error.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Section title="Riwayat pemeriksaan">
          <Panel>
            {checks.isPending ? (
              <RowsSkeleton rows={4} label="Memuat riwayat" />
            ) : checks.isError ? (
              <ErrorState
                error={checks.error}
                onRetry={() => void checks.refetch()}
                retrying={checks.isFetching}
              />
            ) : checks.data.length === 0 ? (
              <EmptyState message="Belum ada pemeriksaan. Pilih entitas lalu tekan Periksa sekarang." />
            ) : (
              <ul className="divide-y text-dense">
                {checks.data.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => url.set({ check: String(c.id) })}
                      aria-current={selected === c.id ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface ${selected === c.id ? 'bg-surface' : ''}`}
                    >
                      <span className="w-20 shrink-0 font-semibold">{ENTITY[c.entity_type]}</span>
                      <span className="w-28 shrink-0">
                        <Dot {...CHECK_STATUS[c.status]} pulse={c.status === 'running'} />
                      </span>
                      <span className="flex-1 text-muted">
                        {c.status === 'drift'
                          ? `${c.drift_count} temuan`
                          : `${c.checked_count} data`}
                      </span>
                      <span className="text-muted">
                        <TimeText iso={c.started_at} mode="short" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Section>

        <Section title="Detail pemeriksaan">
          {selected === null ? (
            <Panel>
              <EmptyState message="Pilih pemeriksaan di riwayat untuk melihat temuannya." />
            </Panel>
          ) : (
            <CheckDetail id={selected} />
          )}
        </Section>
      </div>
    </div>
  )
}

function CheckDetail({ id }: { id: number }) {
  // Repairs sent (202) for this check. "Still repairing" = sent and not yet repaired on the server.
  const [sent, setSent] = useState<number[]>([])
  const [polling, setPolling] = useState(false)
  const q = useCheck(id, polling)
  const pending = sent.filter((fid) => !q.data?.findings.find((f) => f.id === fid)?.repaired_at)
  if (polling !== pending.length > 0) setPolling(pending.length > 0)

  if (q.isPending)
    return (
      <Panel>
        <RowsSkeleton rows={4} label="Memuat temuan" />
      </Panel>
    )
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      </Panel>
    )
  const c = q.data
  const ms = c.finished_at
    ? new Date(c.finished_at).getTime() - new Date(c.started_at).getTime()
    : null
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2.5 text-dense">
        <span className="font-semibold">{ENTITY[c.entity_type]}</span>
        <Dot {...CHECK_STATUS[c.status]} pulse={c.status === 'running'} />
        <span className="text-muted">
          <TimeText iso={c.started_at} />
          {ms !== null ? ` · ${duration(ms)}` : ''}
        </span>
        <span className="text-muted">{c.checked_count} data diperiksa</span>
      </div>
      {c.status === 'running' ? (
        <p role="status" className="flex items-center gap-2 px-3 py-6 text-dense text-muted">
          <Spinner /> Membandingkan data di tiga console… Hasil muncul di sini otomatis.
        </p>
      ) : c.status === 'failed' ? (
        <EmptyState message="Pemeriksaan gagal: salah satu console tidak dapat dihubungi. Cek halaman Console, lalu periksa lagi." />
      ) : c.findings.length === 0 ? (
        <EmptyState message="Bersih. Semua salinan sama dengan data pemiliknya." />
      ) : (
        <FindingsTable
          checkId={c.id}
          findings={c.findings}
          sent={pending}
          onSent={(fid) => setSent((s) => [...s, fid])}
        />
      )}
    </Panel>
  )
}

function FindingsTable({
  checkId,
  findings,
  sent,
  onSent,
}: {
  checkId: number
  findings: ConsistencyFinding[]
  sent: number[]
  onSent: (id: number) => void
}) {
  const can = useCan()
  const repair = useRepair(checkId)
  const [target, setTarget] = useState<ConsistencyFinding | null>(null)
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Data</Th>
            <Th>Console tertinggal</Th>
            <Th>Jenis</Th>
            <Th className="text-right">Versi pemilik</Th>
            <Th className="text-right">Versi console</Th>
            <Th>
              <span className="sr-only">Aksi</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <Tr key={f.id}>
              <Td>
                <span className="font-semibold">{f.label}</span>
              </Td>
              <Td>{f.console.name}</Td>
              <Td>{KIND[f.kind]}</Td>
              <Td className="text-right font-mono">{f.owner_version ?? '—'}</Td>
              <Td className="text-right font-mono">{f.console_version ?? '—'}</Td>
              <Td className="text-right">
                {f.repaired_at ? (
                  <Dot tone="ok" label="Diperbaiki" />
                ) : sent.includes(f.id) ? (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <Spinner /> Memperbaiki…
                  </span>
                ) : can('admin.consistency.repair') ? (
                  <Button
                    onClick={() => setTarget(f)}
                    aria-label={`Perbaiki ${f.label} di ${f.console.name}`}
                  >
                    Perbaiki
                  </Button>
                ) : null}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {target ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setTarget(null)}
          title={`Perbaiki ${target.label}?`}
          description={`${target.console.name} · ${KIND[target.kind]}`}
          confirmLabel="Perbaiki"
          busyLabel="Mengirim…"
          busy={repair.isPending}
          onConfirm={() =>
            repair.mutate(target.id, {
              onSuccess: () => {
                onSent(target.id)
                setTarget(null)
              },
            })
          }
        >
          <p>
            Data dari pemilik akan disalin ke {target.console.name}. Isi di {target.console.name}{' '}
            yang berbeda akan ditimpa.
          </p>
          {repair.isError ? (
            <p role="alert" className="text-dense text-error">
              {describeError(repair.error, true).title}: {repair.error.message}
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </>
  )
}
