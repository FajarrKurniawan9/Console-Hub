import { useNavigate } from 'react-router'
import { RunStatusDot } from '../../components/StatusDot'
import { TimeText } from '../../components/TimeText'
import { Table, Td, Th, Tr } from '../../components/ui/Table'
import { runDuration } from '../../lib/format'
import type { Run } from '../../lib/schemas'

/** Run rows; the whole row opens the run. Used by the overview and the runs page. */
export function RunsTable({ runs }: { runs: Run[] }) {
  const navigate = useNavigate()
  return (
    <Table>
      <thead>
        <tr>
          <Th>Status</Th>
          <Th>Proses</Th>
          <Th>Pemicu</Th>
          <Th>Mulai</Th>
          <Th className="text-right">Durasi</Th>
          <Th>Ringkasan error</Th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => {
          const open = () => navigate(`/runs/${r.id}`)
          return (
            <Tr
              key={r.id}
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) => e.key === 'Enter' && open()}
              aria-label={`Eksekusi ${r.id}, ${r.process.name}`}
              className="cursor-pointer hover:bg-surface"
            >
              <Td>
                <RunStatusDot status={r.status} />
              </Td>
              <Td>
                <div className="flex flex-col">
                  <span className="whitespace-nowrap">{r.process.name}</span>
                  <span className="font-mono text-xs text-muted">{r.id}</span>
                </div>
              </Td>
              <Td className="whitespace-nowrap">{r.triggered_by.name}</Td>
              <Td className="whitespace-nowrap">
                <TimeText iso={r.started_at ?? r.created_at} mode="short" />
              </Td>
              <Td className="text-right font-mono whitespace-nowrap">
                {runDuration(r.started_at, r.finished_at) ?? '—'}
              </Td>
              <Td className="w-full max-w-0">
                <span className="block truncate text-muted" title={r.error_summary ?? undefined}>
                  {r.error_summary ?? '—'}
                </span>
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}
