import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Pencil, Search } from 'lucide-react'
import { Tabs } from 'radix-ui'
import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { ConsoleStatusDot } from '../../components/StatusDot'
import { Button } from '../../components/ui/Button'
import { inputClass } from '../../components/ui/Input'
import { Table, Td, Th, Tr } from '../../components/ui/Table'
import { number } from '../../lib/format'
import type { DataRecord, HubConsole } from '../../lib/schemas'
import { useUrlState } from '../../lib/useUrlState'
import { useConsoles } from '../consoles/queries'
import { EditPanel } from './EditPanel'
import { COLUMN_LABELS, columnOf, display, recordLabel } from './fields'
import { useResource } from './queries'

const PER_PAGE = 10

export function DataPage() {
  const url = useUrlState()
  const consoles = useConsoles()

  // Default to the first console's first resource.
  const selectedConsole =
    consoles.data?.find((c) => String(c.id) === url.get('console')) ?? consoles.data?.[0]
  const resource =
    selectedConsole?.resources.find((r) => r.key === url.get('resource')) ??
    selectedConsole?.resources[0]

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Data console"
        meta="Lihat dan ubah data langsung di console asal. Hanya field yang diizinkan console yang dapat diubah."
      />
      {consoles.isPending ? (
        <RowsSkeleton rows={3} label="Memuat console" />
      ) : consoles.isError ? (
        <Panel>
          <ErrorState error={consoles.error} onRetry={() => void consoles.refetch()} />
        </Panel>
      ) : !selectedConsole || !resource ? (
        <EmptyState message="Belum ada console dengan sumber data. Admin dapat menambahkannya di backend portal." />
      ) : (
        <Tabs.Root
          value={`${selectedConsole.id}:${resource.key}`}
          onValueChange={(v) => {
            const [c, r] = v.split(':')
            url.set({ console: c!, resource: r!, page: null, q: null })
          }}
          className="flex flex-col gap-3"
        >
          <Tabs.List aria-label="Sumber data" className="flex flex-wrap gap-1 border-b">
            {consoles.data.flatMap((c) =>
              c.resources.map((r) => (
                <Tabs.Trigger
                  key={`${c.id}:${r.key}`}
                  value={`${c.id}:${r.key}`}
                  className="-mb-px inline-flex h-9 items-center gap-2 border-b-2 border-transparent px-3 text-dense text-muted hover:text-fg data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-fg"
                >
                  <span className="text-muted">{c.name.replace(/^Web /, '')}</span>
                  {r.label}
                  {c.status === 'down' ? (
                    <span className="text-xs text-error" aria-label="console mati">
                      ● mati
                    </span>
                  ) : null}
                </Tabs.Trigger>
              )),
            )}
          </Tabs.List>
          <Tabs.Content value={`${selectedConsole.id}:${resource.key}`} className="outline-none">
            <ResourceView
              key={`${selectedConsole.id}:${resource.key}`}
              console={selectedConsole}
              resourceKey={resource.key}
              label={resource.label}
              writable={resource.writable_fields}
              url={url}
            />
          </Tabs.Content>
        </Tabs.Root>
      )}
    </div>
  )
}

function ResourceView({
  console: c,
  resourceKey,
  label,
  writable,
  url,
}: {
  console: HubConsole
  resourceKey: string
  label: string
  writable: string[]
  url: ReturnType<typeof useUrlState>
}) {
  const page = Math.max(Number(url.get('page')) || 1, 1)
  const urlQ = url.get('q')
  const [text, setText] = useState(urlQ)
  useEffect(() => {
    if (text === urlQ) return
    const t = setTimeout(() => url.set({ q: text || null, page: null }), 300)
    return () => clearTimeout(t)
  }, [text, urlQ, url])

  const q = useResource({ consoleId: c.id, key: resourceKey, page, perPage: PER_PAGE, q: urlQ })
  const [editing, setEditing] = useState<DataRecord | null>(null)

  const rows = q.data?.data ?? []
  const total = q.data?.meta.total ?? null
  const pages = total !== null ? Math.max(Math.ceil(total / PER_PAGE), 1) : null
  // Columns come from the data; `id` is internal.
  const columns = rows[0]
    ? Object.keys(rows[0]).filter((k) => k !== 'id' && k !== 'division_id')
    : []
  const writableColumns = new Set(writable.map(columnOf))
  // Failed now, but an earlier page is still cached: show it dimmed.
  const stale = q.isError && q.data !== undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-dense">
          <span className="font-semibold">
            {c.name} · {label}
          </span>
          <ConsoleStatusDot status={c.status} />
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">Cari {label}</span>
          <Search
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-2.5 text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Cari di ${label.toLowerCase()}`}
            className={`${inputClass} w-64 pl-8`}
          />
        </label>
      </div>

      {q.isError ? (
        <Panel>
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        </Panel>
      ) : null}

      {q.isPending ? (
        <Panel>
          <RowsSkeleton rows={PER_PAGE} label={`Memuat ${label}`} />
        </Panel>
      ) : q.isError && !stale ? null : rows.length === 0 ? (
        <Panel>
          <EmptyState
            message={
              urlQ
                ? `Tidak ada ${label.toLowerCase()} yang cocok dengan "${urlQ}".`
                : `${c.name} belum punya data ${label.toLowerCase()}.`
            }
            action={urlQ ? <Button onClick={() => setText('')}>Hapus pencarian</Button> : undefined}
          />
        </Panel>
      ) : (
        <Panel className={clsx(stale && 'opacity-60')}>
          {stale ? (
            <p className="border-b px-3 py-1.5 text-xs text-muted">
              Data terakhir yang berhasil diambil. Tidak dapat diubah sampai {c.name} pulih.
            </p>
          ) : null}
          <Table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <Th key={col} className={clsx(typeof rows[0]![col] === 'number' && 'text-right')}>
                    {COLUMN_LABELS[col] ?? col}
                    {writableColumns.has(col) ? (
                      <Pencil
                        size={12}
                        strokeWidth={1.5}
                        className="ml-1 inline align-[-1px] text-accent"
                        aria-label="dapat diubah"
                      />
                    ) : null}
                  </Th>
                ))}
                <Th className="w-0">
                  <span className="sr-only">Aksi</span>
                </Th>
              </tr>
            </thead>
            <tbody
              className={clsx(
                q.isFetching && !stale && 'opacity-70 transition-opacity duration-150',
              )}
            >
              {rows.map((r) => (
                <Tr key={String(r.id)} className="hover:bg-surface">
                  {columns.map((col) => (
                    <Td
                      key={col}
                      className={clsx(
                        typeof r[col] === 'number' && 'text-right font-mono',
                        /^(nik|sku)$/.test(col) && 'font-mono',
                        writableColumns.has(col) && 'bg-accent/[0.03]',
                      )}
                    >
                      {display(col, r[col])}
                    </Td>
                  ))}
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setEditing(r)}
                      disabled={stale || c.status === 'down'}
                      aria-label={`Ubah ${recordLabel(r)}`}
                    >
                      <Pencil size={14} strokeWidth={1.5} aria-hidden />
                      Ubah
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-dense">
            <span className="text-muted">
              {total !== null
                ? `${number((page - 1) * PER_PAGE + 1)}–${number(Math.min(page * PER_PAGE, total))} dari ${number(total)}`
                : `Halaman ${page}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="h-7 px-2"
                disabled={page <= 1 || stale}
                onClick={() => url.set({ page: page - 1 > 1 ? String(page - 1) : null })}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={16} strokeWidth={1.5} aria-hidden />
              </Button>
              <span className="font-mono tabular-nums">
                {page}
                {pages ? ` / ${pages}` : ''}
              </span>
              <Button
                variant="ghost"
                className="h-7 px-2"
                disabled={!q.data?.meta.next_cursor || stale}
                onClick={() => url.set({ page: String(page + 1) })}
                aria-label="Halaman berikutnya"
              >
                <ChevronRight size={16} strokeWidth={1.5} aria-hidden />
              </Button>
            </div>
          </div>
        </Panel>
      )}

      <EditPanel
        consoleId={c.id}
        consoleName={c.name}
        resourceKey={resourceKey}
        writable={writable}
        record={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
