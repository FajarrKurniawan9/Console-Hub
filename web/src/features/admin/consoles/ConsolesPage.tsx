import { useNavigate } from 'react-router'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader, Panel } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { ConsoleStatusDot } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import { duration } from '../../../lib/format'
import { sortByAttention, useConsoles } from './queries'

export function ConsolesPage() {
  const q = useConsoles()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Sumber data"
        meta="Tiga API sumber (Gudang, Produksi, HR) yang dipakai hub. Kunci layanan disimpan di backend."
      />
      <Panel>
        {q.isPending ? (
          <RowsSkeleton rows={3} label="Memuat sumber data" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : q.data.length === 0 ? (
          <EmptyState message="Belum ada API sumber yang terdaftar. Sumber didaftarkan di backend hub." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>API sumber</Th>
                <Th>Status</Th>
                <Th className="text-right">Latensi</Th>
                <Th>Dicek</Th>
                <Th>Alamat</Th>
              </tr>
            </thead>
            <tbody>
              {sortByAttention(q.data).map((c) => {
                const open = () => navigate(`/console/${c.id}`)
                return (
                  <Tr
                    key={c.id}
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => e.key === 'Enter' && open()}
                    aria-label={`Buka ${c.name}`}
                    className="cursor-pointer hover:bg-surface"
                  >
                    <Td className="font-semibold">{c.name}</Td>
                    <Td>
                      <ConsoleStatusDot status={c.status} />
                    </Td>
                    <Td className="text-right font-mono">
                      {c.latency_ms !== null ? duration(c.latency_ms) : '—'}
                    </Td>
                    <Td className="text-muted">
                      {c.last_checked_at ? (
                        <TimeText iso={c.last_checked_at} mode="relative" />
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="font-mono text-muted">{c.base_url}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
