import clsx from 'clsx'
import { ChevronRight, Hand } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ConsoleChip } from '../../components/ConsoleChip'
import { JsonView } from '../../components/JsonView'
import { StepStatusDot } from '../../components/StatusDot'
import { Table, Td, Th } from '../../components/ui/Table'
import { duration, number } from '../../lib/format'
import { shortagesOf, stepDetails } from '../../lib/runs'
import type { Run, RunStep } from '../../lib/schemas'
import { useConsoles } from '../consoles/queries'

const NEEDS_ATTENTION = new Set<RunStep['status']>(['failed', 'compensation_failed'])

export function StepList({
  run,
  selected,
  onSelect,
}: {
  run: Run
  selected: number | null
  onSelect: (pos: number | null) => void
}) {
  const consoles = useConsoles()
  const steps = run.steps ?? []
  // Default: failed steps open, others closed. A user toggle overrides the default;
  // the step selected from the strip is always open.
  const [override, setOverride] = useState<Map<number, boolean>>(() => new Map())
  const isOpen = (s: RunStep) =>
    s.position === selected || (override.get(s.position) ?? NEEDS_ATTENTION.has(s.status))
  // Closing the selected step also drops the selection, or it would stay forced open.
  const toggle = (s: RunStep) => {
    setOverride((m) => new Map(m).set(s.position, !isOpen(s)))
    if (s.position === selected) onSelect(null)
  }

  // A click on the strip scrolls to that step.
  const refs = useRef(new Map<number, HTMLLIElement>())
  useEffect(() => {
    if (selected !== null) refs.current.get(selected)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const consoleOf = (slug: string | undefined) => consoles.data?.find((c) => c.slug === slug)

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s) => {
        const c = consoleOf(s.console?.slug)
        const expanded = isOpen(s)
        const panelId = `step-${s.position}-body`
        return (
          <li
            key={s.position}
            ref={(el) => {
              if (el) refs.current.set(s.position, el)
            }}
            className={clsx(
              'overflow-hidden rounded-md border bg-bg',
              NEEDS_ATTENTION.has(s.status) && 'border-error',
              selected === s.position && 'ring-2 ring-accent',
            )}
          >
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => {
                toggle(s)
              }}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-left text-dense hover:bg-surface"
            >
              <ChevronRight
                size={16}
                strokeWidth={1.5}
                aria-hidden
                className={clsx(
                  'shrink-0 text-muted transition-transform duration-150',
                  expanded && 'rotate-90',
                )}
              />
              <span className="w-5 font-mono text-muted">{s.position}</span>
              <span className="min-w-40 flex-1 font-semibold">{s.name}</span>
              <span className="w-36">
                <StepStatusDot status={s.status} />
              </span>
              <span className="w-28">
                {s.console ? (
                  <ConsoleChip name={c?.name ?? s.console.slug} down={c?.status === 'down'} />
                ) : null}
              </span>
              <span className="w-20 text-right font-mono text-muted">
                {s.duration_ms != null ? duration(s.duration_ms) : '—'}
              </span>
              <span className="w-24 text-right text-xs text-muted">
                {s.attempt > 0 ? `percobaan ke-${s.attempt}` : 'belum jalan'}
              </span>
            </button>
            {expanded ? (
              <div id={panelId} className="flex flex-col gap-3 border-t px-3 py-3">
                <StepBody step={s} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function StepBody({ step: s }: { step: RunStep }) {
  const shortages = shortagesOf(s)
  const details = stepDetails(s)
  return (
    <>
      {s.status === 'compensation_failed' ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-error px-3 py-2 text-dense"
        >
          <Hand size={16} strokeWidth={1.5} className="mt-px shrink-0 text-error" aria-hidden />
          <span>
            <span className="font-semibold">Perlu tindakan manual.</span> Langkah ini sudah berhasil
            tetapi gagal dibatalkan, jadi datanya masih ada di console. Batalkan secara manual di
            console terkait.
          </span>
        </p>
      ) : s.status === 'compensated' ? (
        <p className="rounded-md border border-warn px-3 py-2 text-dense">
          <span className="font-semibold">Dikompensasi.</span> Langkah ini sempat berhasil, lalu
          dibatalkan otomatis karena langkah berikutnya gagal.
        </p>
      ) : s.status === 'skipped' ? (
        <p className="text-dense text-muted">
          Tidak dijalankan karena langkah sebelumnya gagal atau eksekusi dibatalkan.
        </p>
      ) : s.status === 'pending' ? (
        <p className="text-dense text-muted">Menunggu langkah sebelumnya selesai.</p>
      ) : null}

      {s.error ? <p className="font-mono text-dense break-words text-error">{s.error}</p> : null}

      {shortages?.length ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Kekurangan stok</span>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th>Barang</Th>
                  <Th className="text-right">Dibutuhkan</Th>
                  <Th className="text-right">Tersedia</Th>
                  <Th className="text-right">Kurang</Th>
                </tr>
              </thead>
              <tbody>
                {shortages.map((x) => (
                  <tr key={x.sku}>
                    <Td className="font-mono">{x.sku}</Td>
                    <Td>{x.name ?? '—'}</Td>
                    <Td className="text-right font-mono">
                      {number(x.needed)} {x.unit}
                    </Td>
                    <Td className="text-right font-mono">
                      {number(x.available)} {x.unit}
                    </Td>
                    <Td className="text-right font-mono font-semibold text-error">
                      {number(Math.max(x.needed - x.available, 0))} {x.unit}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      ) : details ? (
        <JsonView value={details} label="Detail error" />
      ) : null}

      {s.request ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <JsonView
            value={s.request.body ?? null}
            label={`Request · ${s.request.method} ${s.request.url}`}
          />
          <JsonView
            value={s.response?.body ?? null}
            label={s.response ? `Response · HTTP ${s.response.status}` : 'Response · belum ada'}
          />
        </div>
      ) : null}
    </>
  )
}
