import { useQuery } from '@tanstack/react-query'
import { Info, Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { Dot } from '../../../components/StatusDot'
import { inputClass } from '../../../components/ui/Input'
import type { PersonRef, SourceStatus, TrackingResult } from '../../../lib/api/schemas'
import { listOf } from '../../../lib/api/work'
import { duration, number } from '../../../lib/format'
import { SOURCE_RESULT } from '../../../lib/status'
import { SOURCE_LABEL } from '../labels'
import { Facts, Merged } from '../Merged'
import { useTracking, workKeys } from '../queries'

/** Lacak Barang (update 2 §4.1.5): search an item, then one merged page from three sources. */
export function LacakPage() {
  const { itemId = null } = useParams()
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Lacak barang" />
      <ItemSearch />
      {itemId ? <TrackingView id={itemId} /> : null}
    </div>
  )
}

function ItemSearch() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(term.trim()), 300)
    return () => clearTimeout(t)
  }, [term])
  const results = useQuery({
    queryKey: [...workKeys.all('items'), 'search', q],
    queryFn: () => listOf('items', { q, limit: 8 }).then((p) => p.data),
    enabled: q.length >= 2,
  })

  return (
    <div role="search" aria-label="Cari barang untuk dilacak" className="flex flex-col gap-2">
      <label className="relative flex items-center">
        <span className="sr-only">Cari barang</span>
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-2.5 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Ketik nama barang, mis. kain katun"
          className={`${inputClass} w-full pl-8`}
        />
      </label>
      <div aria-live="polite">
        {q.length < 2 ? null : results.isPending ? (
          <p className="text-dense text-muted">Mencari…</p>
        ) : results.isError ? (
          <Panel>
            <ErrorState error={results.error} onRetry={() => void results.refetch()} />
          </Panel>
        ) : results.data.length === 0 ? (
          <p className="text-dense text-muted">Tidak ada barang dengan nama "{q}".</p>
        ) : (
          <Panel>
            <ul className="divide-y">
              {results.data.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTerm('')
                      navigate(`/lacak/${i.id}`)
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface"
                  >
                    <span className="font-semibold">{i.name}</span>
                    <span className="text-dense text-muted">
                      {i.kind} · {number(i.quantity)} {i.unit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  )
}

function TrackingView({ id }: { id: string }) {
  const q = useTracking(id)
  // One request covers all three sources; while it runs each step says it is loading,
  // so a slow source (`slow-source`) reads as "still fetching", not as a blank page.
  if (q.isPending)
    return (
      <ol aria-label="Memuat rantai barang" aria-busy="true" className="flex flex-col">
        {['Gudang', 'Produksi', 'HR'].map((t, i) => (
          <Step key={t} title={t} last={i === 2}>
            <RowsSkeleton
              rows={2}
              label={`Memuat data ${t === 'HR' ? 'personel' : t.toLowerCase()}`}
            />
          </Step>
        ))}
      </ol>
    )
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
      </Panel>
    )
  return <TrackingChain result={q.data} />
}

const person = (p: PersonRef | null) => (p ? `${p.name} · ${p.role}` : null)

function TrackingChain({ result: r }: { result: TrackingResult }) {
  const it = r.item
  const courierId = r.production?.courier_id ?? null
  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      {r.warnings.length ? (
        <ul className="flex flex-col gap-1 rounded-md border px-3 py-2 text-dense">
          {r.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <Info size={16} strokeWidth={1.5} className="mt-px shrink-0 text-muted" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      <ol aria-label="Rantai barang" className="flex flex-col">
        <Step title="Gudang" last={false}>
          <Facts
            rows={[
              ['Barang', <span className="font-semibold">{it.name}</span>],
              ['Jenis', it.kind],
              ['Jumlah', `${number(it.quantity)} ${it.unit}`],
            ]}
          />
        </Step>
        <Step title="Produksi" last={false}>
          {!it.production_id ? (
            <p className="text-dense text-muted">Barang ini tidak punya asal produksi.</p>
          ) : (
            <Facts
              rows={[
                [
                  'Asal produksi',
                  <Merged id={it.production_id}>{r.production?.area ?? null}</Merged>,
                ],
                [
                  'Jenis produksi',
                  <Merged id={it.production_id}>{r.production?.production_type ?? null}</Merged>,
                ],
              ]}
            />
          )}
        </Step>
        <Step title="HR" last>
          <Facts
            rows={[
              ['Penanggung jawab', <Merged id={it.responsible_id}>{person(r.responsible)}</Merged>],
              [
                'Pengantar',
                // The courier id comes from Produksi; unknown when Produksi did not answer.
                <Merged id={courierId ?? (it.production_id && !r.production ? 'unknown' : null)}>
                  {person(r.courier)}
                </Merged>,
              ],
            ]}
          />
        </Step>
      </ol>

      {r.sources ? <SourcesPanel sources={r.sources} /> : null}

      <Link
        to="/barang"
        className="self-start text-dense text-accent underline-offset-4 hover:underline"
      >
        Kembali ke daftar barang
      </Link>
    </div>
  )
}

/** One step of the vertical chain: small title, thin connecting line to the next one. */
function Step({ title, last, children }: { title: string; last: boolean; children: ReactNode }) {
  return (
    <li className="relative grid grid-cols-[16px_1fr] gap-x-3">
      <span aria-hidden className="relative flex justify-center">
        <span className="mt-1.5 size-2 rounded-full bg-accent" />
        {last ? null : <span className="absolute top-4 bottom-0 w-px bg-border" />}
      </span>
      <div className={last ? '' : 'pb-6'}>
        <h2 className="pb-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
        {children}
      </div>
    </li>
  )
}

/** Admin IT: proof that one search hit all three source APIs. */
function SourcesPanel({ sources }: { sources: SourceStatus[] }) {
  return (
    <Section title="Sumber data">
      <Panel>
        <ul className="divide-y text-dense">
          {sources.map((s) => (
            <li key={s.source} className="flex items-center gap-4 px-3 py-2">
              <span className="w-24 font-semibold">{SOURCE_LABEL[s.source]}</span>
              <span className="w-36">
                <Dot {...SOURCE_RESULT[s.status]} />
              </span>
              <span className="ml-auto font-mono tabular-nums text-muted">
                {s.latency_ms !== null ? duration(s.latency_ms) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </Section>
  )
}
