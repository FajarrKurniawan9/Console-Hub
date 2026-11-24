import { useState } from 'react'
import { ConsoleChip } from '../../../components/ConsoleChip'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { JsonView } from '../../../components/JsonView'
import { PageHeader, Panel } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { TimeText } from '../../../components/TimeText'
import { Button } from '../../../components/ui/Button'
import { inputClass } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Spinner } from '../../../components/ui/Spinner'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import { number } from '../../../lib/format'
import { useUrlState } from '../../../lib/useUrlState'
import { useConsoles } from '../consoles/queries'
import { useRbacUsers } from '../rbac/queries'
import { ACTIONS, changesOf, summaryOf } from './summary'
import { useAudit } from './queries'
import { ExportAction } from '../../reports/ExportAction'

const toIso = (local: string) => (local ? new Date(local).toISOString() : null)

export function AuditPage() {
  const url = useUrlState()
  const consoles = useConsoles()
  const users = useRbacUsers()
  const consoleName = (slug: string) => consoles.data?.find((c) => c.slug === slug)?.name
  const filters = {
    user_id: url.get('user'),
    console_id: url.get('console'),
    action: url.get('action'),
    from: toIso(url.get('from')),
    to: toIso(url.get('to')),
  }
  const q = useAudit(filters)
  const rows = q.data?.pages.flatMap((p) => p.data) ?? []
  const total = q.data?.pages[0]?.meta.total
  const filtered = Object.values(filters).some(Boolean)
  const clear = () => url.set({ user: null, console: null, action: null, from: null, to: null })
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Audit"
        meta={
          total != null
            ? `${number(total)} catatan · terbaru di atas`
            : 'Siapa mengubah apa, di console mana'
        }
        actions={
          <ExportAction
            type="audit"
            title="Audit"
            filterSummary={filtered ? 'Menerapkan filter yang sedang dipilih' : 'Semua catatan audit'}
            filters={filters}
          />
        }
      />
      <div
        role="search"
        aria-label="Filter audit"
        className="flex flex-wrap items-center gap-2 text-dense"
      >
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Pengguna</span>
          <Select
            value={url.get('user')}
            onChange={(e) => url.set({ user: e.target.value || null })}
          >
            <option value="">Semua</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Console</span>
          <Select
            value={url.get('console')}
            onChange={(e) => url.set({ console: e.target.value || null })}
          >
            <option value="">Semua</option>
            {(consoles.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Aksi</span>
          <Select
            value={url.get('action')}
            onChange={(e) => url.set({ action: e.target.value || null })}
          >
            <option value="">Semua</option>
            {Object.entries(ACTIONS).map(([k, label]) => (
              <option key={k} value={k}>
                {label} ({k})
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Dari</span>
          <input
            type="datetime-local"
            value={url.get('from')}
            onChange={(e) => url.set({ from: e.target.value || null })}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Sampai</span>
          <input
            type="datetime-local"
            value={url.get('to')}
            onChange={(e) => url.set({ to: e.target.value || null })}
            className={inputClass}
          />
        </label>
        {filtered ? (
          <Button variant="ghost" onClick={clear}>
            Hapus filter
          </Button>
        ) : null}
      </div>

      <Panel>
        {q.isPending ? (
          <RowsSkeleton rows={10} label="Memuat audit" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              message="Tidak ada catatan audit yang cocok dengan filter."
              action={<Button onClick={clear}>Hapus filter</Button>}
            />
          ) : (
            <EmptyState message="Belum ada catatan audit. Catatan muncul saat data diubah atau proses dijalankan." />
          )
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Pengguna</Th>
                  <Th>Aksi</Th>
                  <Th>Target</Th>
                  <Th>Console</Th>
                  <Th>Perubahan</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const changes = changesOf(e)
                  const summary = summaryOf(e)
                  const expanded = open === e.id
                  return (
                    <Tr key={e.id} className="align-top">
                      <Td className="whitespace-nowrap text-muted">
                        <TimeText iso={e.created_at} />
                      </Td>
                      <Td className="whitespace-nowrap">
                        {e.user?.name ?? <span className="text-muted">sistem</span>}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{ACTIONS[e.action] ?? e.action}</span>
                          <span className="font-mono text-xs text-muted">{e.action}</span>
                        </div>
                      </Td>
                      <Td className="font-mono whitespace-nowrap">
                        {e.target_id ?? <span className="text-muted">—</span>}
                      </Td>
                      <Td>
                        {e.console ? (
                          <ConsoleChip name={consoleName(e.console.slug) ?? e.console.slug} />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                      <Td className="w-full py-2">
                        {changes.length ? (
                          <ul className="flex flex-col gap-0.5">
                            {changes.map((c) => (
                              <li key={c.field}>
                                <span className="font-mono">{c.field}</span>:{' '}
                                <span className="font-mono text-muted line-through">{c.old}</span> →{' '}
                                <span className="font-mono">{c.new}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted">{summary || '—'}</span>
                        )}
                        {e.details ? (
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : e.id)}
                            className="mt-1 block text-xs text-accent hover:underline"
                          >
                            {expanded ? 'Sembunyikan detail' : 'Detail'}
                          </button>
                        ) : null}
                        {expanded ? (
                          <div className="mt-2">
                            <JsonView value={e.details} label="details" />
                          </div>
                        ) : null}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            {q.hasNextPage ? (
              <div className="flex justify-center p-3">
                <Button onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                  {q.isFetchingNextPage ? <Spinner /> : null}
                  Muat lebih banyak
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  )
}
