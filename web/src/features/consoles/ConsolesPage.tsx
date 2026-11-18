import { useNavigate } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { ConsoleStatusDot } from '../../components/StatusDot'
import { TimeText } from '../../components/TimeText'
import { Table, Td, Th, Tr } from '../../components/ui/Table'
import { duration } from '../../lib/format'
import { AUTH_LABEL } from './labels'
import { sortByAttention, useConsoles } from './queries'

export function ConsolesPage() {
  const q = useConsoles()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Console"
        meta="Web console yang terhubung ke portal. Kredensial disimpan di backend dan tidak pernah ditampilkan."
      />
      <Panel>
        {q.isPending ? (
          <RowsSkeleton rows={3} label="Memuat console" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : q.data.length === 0 ? (
          <EmptyState message="Belum ada console yang terhubung. Admin dapat menambahkannya di backend portal." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Console</Th>
                <Th>Status</Th>
                <Th className="text-right">Latensi</Th>
                <Th>Dicek</Th>
                <Th>Alamat</Th>
                <Th>Login</Th>
                <Th>Sumber data</Th>
              </tr>
            </thead>
            <tbody>
              {sortByAttention(q.data).map((c) => {
                const open = () => navigate(`/consoles/${c.id}`)
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
                      {c.last_latency_ms !== null ? duration(c.last_latency_ms) : '—'}
                    </Td>
                    <Td className="text-muted">
                      {c.last_checked_at ? (
                        <TimeText iso={c.last_checked_at} mode="relative" />
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="font-mono text-muted">{c.base_url}</Td>
                    <Td>{AUTH_LABEL[c.auth_type]}</Td>
                    <Td className="text-muted">{c.resources.map((r) => r.label).join(', ')}</Td>
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
