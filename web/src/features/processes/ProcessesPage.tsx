import { useNavigate } from 'react-router'
import { ConsoleChip } from '../../components/ConsoleChip'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { Table, Td, Th, Tr } from '../../components/ui/Table'
import { useConsoles } from '../consoles/queries'
import { involvedConsoles } from './steps'
import { useProcesses } from './queries'

export function ProcessesPage() {
  const q = useProcesses()
  const consoles = useConsoles()
  const navigate = useNavigate()
  const isDown = (slug: string) =>
    consoles.data?.some((c) => c.slug === slug && c.status === 'down') ?? false
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Proses"
        meta="Rangkaian langkah yang memanggil API di beberapa console. Definisi hanya dapat dibaca di sini."
      />
      <Panel>
        {q.isPending ? (
          <RowsSkeleton rows={3} label="Memuat proses" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : q.data.length === 0 ? (
          <EmptyState message="Belum ada proses yang didefinisikan. Admin dapat menambahkannya di backend portal." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Proses</Th>
                <Th className="text-right">Langkah</Th>
                <Th>Console yang terlibat</Th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => {
                const open = () => navigate(`/processes/${p.id}`)
                return (
                  <Tr
                    key={p.id}
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => e.key === 'Enter' && open()}
                    aria-label={`Buka proses ${p.name}`}
                    className="cursor-pointer hover:bg-surface"
                  >
                    <Td className="py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold">
                          {p.name}
                          {!p.is_active ? (
                            <span className="ml-2 text-xs font-normal text-muted">(nonaktif)</span>
                          ) : null}
                        </span>
                        <span className="text-muted">{p.description}</span>
                      </div>
                    </Td>
                    <Td className="text-right font-mono">{p.steps.length}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {involvedConsoles(p).map((c) => (
                          <ConsoleChip key={c.slug} name={c.name} down={isDown(c.slug)} />
                        ))}
                      </div>
                    </Td>
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
