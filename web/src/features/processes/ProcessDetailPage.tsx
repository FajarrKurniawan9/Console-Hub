import { Play, RotateCcw, Undo2, ArrowRightToLine } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ConsoleChip } from '../../components/ConsoleChip'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { Button } from '../../components/ui/Button'
import { useConsoles } from '../consoles/queries'
import { useProcess } from './queries'
import { RunDialog } from './RunDialog'

export function ProcessDetailPage() {
  const id = Number(useParams().id)
  const q = useProcess(id)
  const consoles = useConsoles()
  const [open, setOpen] = useState(false)

  if (q.isPending) return <RowsSkeleton rows={6} label="Memuat proses" />
  if (q.isError)
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
  const p = q.data
  const down = (slug: string) =>
    consoles.data?.some((c) => c.slug === slug && c.status === 'down') ?? false
  const downSteps = p.steps.filter((s) => down(s.console.slug))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={p.name}
        meta={
          <Link to="/processes" className="hover:text-fg">
            ← Semua proses
          </Link>
        }
        actions={
          <>
            <Link
              to={`/runs?process=${p.id}`}
              className="text-dense text-accent underline-offset-4 hover:underline"
            >
              Riwayat eksekusi
            </Link>
            <Button variant="primary" onClick={() => setOpen(true)} disabled={!p.is_active}>
              <Play size={16} strokeWidth={1.5} aria-hidden />
              Jalankan
            </Button>
          </>
        }
      />
      <p className="max-w-3xl">{p.description}</p>
      <p className="text-dense text-muted">
        {p.compensate_on_failure
          ? 'Bila satu langkah gagal, langkah sebelumnya yang punya kompensasi akan dibatalkan otomatis (urutan terbalik).'
          : 'Tanpa kompensasi otomatis: bila gagal, langkah yang sudah berhasil tetap berlaku.'}
        {!p.is_active ? ' Proses ini nonaktif dan tidak dapat dijalankan.' : ''}
      </p>
      {downSteps.length ? (
        <p role="status" className="rounded-md border border-warn px-3 py-2 text-dense">
          Langkah {downSteps.map((s) => s.position).join(', ')} memanggil{' '}
          {downSteps[0]!.console.name} yang sedang mati. Eksekusi kemungkinan gagal di langkah itu.
        </p>
      ) : null}

      <Section title="Langkah">
        <Panel>
          <ol className="divide-y">
            {p.steps.map((s) => (
              <li key={s.position} className="flex gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs"
                >
                  {s.position}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      <span className="sr-only">Langkah {s.position}: </span>
                      {s.name}
                    </span>
                    <ConsoleChip name={s.console.name} down={down(s.console.slug)} />
                  </div>
                  <code className="font-mono text-dense break-all text-muted">
                    <span className="text-fg">{s.method}</span> {s.path}
                  </code>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <RotateCcw size={12} strokeWidth={1.5} aria-hidden />
                      {s.max_retries ? `coba ulang ${s.max_retries} kali` : 'tanpa coba ulang'}
                    </span>
                    {s.on_failure === 'continue' ? (
                      <span className="inline-flex items-center gap-1 text-fg">
                        <ArrowRightToLine size={12} strokeWidth={1.5} aria-hidden />
                        lanjut bila gagal
                      </span>
                    ) : null}
                    {s.has_compensation ? (
                      <span className="inline-flex items-center gap-1">
                        <Undo2 size={12} strokeWidth={1.5} aria-hidden />
                        punya kompensasi
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </Section>

      <RunDialog process={p} open={open} onOpenChange={setOpen} />
    </div>
  )
}
