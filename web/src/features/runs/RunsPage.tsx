import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { Button } from '../../components/ui/Button'
import { MultiSelect } from '../../components/ui/MultiSelect'
import { Spinner } from '../../components/ui/Spinner'
import { number } from '../../lib/format'
import type { RunStatus } from '../../lib/schemas'
import { RUN_STATUS } from '../../lib/status'
import { useUrlState } from '../../lib/useUrlState'
import { useProcesses } from '../processes/queries'
import { useRuns } from './queries'
import { RunsTable } from './RunsTable'

const STATUSES = (Object.keys(RUN_STATUS) as RunStatus[]).map((s) => ({
  value: s,
  label: RUN_STATUS[s].label,
}))

export function RunsPage() {
  const url = useUrlState()
  const processes = useProcesses()
  const filters = { process_id: url.list('process'), status: url.list('status') }
  const q = useRuns(filters)
  const rows = q.data?.pages.flatMap((p) => p.data) ?? []
  const total = q.data?.pages[0]?.meta.total
  const filtered = filters.process_id.length > 0 || filters.status.length > 0
  const clear = () => url.set({ process: null, status: null })

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Eksekusi"
        meta={
          total != null ? `${number(total)} eksekusi · terbaru di atas` : 'Riwayat eksekusi proses'
        }
      />
      <div role="search" aria-label="Filter eksekusi" className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Proses"
          options={(processes.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
          value={filters.process_id}
          onChange={(v) => url.set({ process: v })}
        />
        <MultiSelect
          label="Status"
          options={STATUSES}
          value={filters.status}
          onChange={(v) => url.set({ status: v })}
        />
        {filtered ? (
          <Button variant="ghost" onClick={clear}>
            Hapus filter
          </Button>
        ) : null}
      </div>
      <Panel>
        {q.isPending ? (
          <RowsSkeleton rows={8} label="Memuat eksekusi" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              message="Tidak ada eksekusi yang cocok dengan filter."
              action={<Button onClick={clear}>Hapus filter</Button>}
            />
          ) : (
            <EmptyState message="Belum ada eksekusi. Jalankan proses dari halaman Proses." />
          )
        ) : (
          <>
            <RunsTable runs={rows} />
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
