import { useNavigate } from 'react-router'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { PageHeader, Panel } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { TxStateBadge } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { Button } from '../../../components/ui/Button'
import { MultiSelect } from '../../../components/ui/MultiSelect'
import { Select } from '../../../components/ui/Select'
import { Spinner } from '../../../components/ui/Spinner'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import { TX_STATES } from '../../../lib/api/schemas'
import { duration, number } from '../../../lib/format'
import { TX_STATE } from '../../../lib/status'
import { useUrlState } from '../../../lib/useUrlState'
import { OPERATIONS, opLabel, reasonOf, txDuration } from './labels'
import { useTransactions } from './queries'

export function TransactionsPage() {
  const url = useUrlState()
  const navigate = useNavigate()
  const states = url.list('state')
  const operation = url.get('operation')
  const q = useTransactions(states, operation)
  const rows = q.data?.pages.flatMap((p) => p.data) ?? []
  const total = q.data?.pages[0]?.meta.total
  const filtered = states.length > 0 || !!operation

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="Transaksi"
        meta={
          total != null
            ? `${number(total)} transaksi · terbaru di atas`
            : 'Setiap penulisan data ke tiga console'
        }
      />
      <div
        role="search"
        aria-label="Filter transaksi"
        className="flex flex-wrap items-center gap-2 text-dense"
      >
        <MultiSelect
          label="Status"
          options={TX_STATES.map((s) => ({ value: s, label: TX_STATE[s].label }))}
          value={states}
          onChange={(v) => url.set({ state: v })}
        />
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Operasi</span>
          <Select
            value={operation}
            onChange={(e) => url.set({ operation: e.target.value || null })}
          >
            <option value="">Semua</option>
            {Object.entries(OPERATIONS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        {filtered ? (
          <Button variant="ghost" onClick={() => url.set({ state: null, operation: null })}>
            Hapus filter
          </Button>
        ) : null}
      </div>
      <Panel>
        {q.isPending ? (
          <RowsSkeleton rows={10} label="Memuat transaksi" />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState
              message="Tidak ada transaksi yang cocok dengan filter."
              action={
                <Button onClick={() => url.set({ state: null, operation: null })}>
                  Hapus filter
                </Button>
              }
            />
          ) : (
            <EmptyState message="Belum ada transaksi. Transaksi tercatat setiap kali data kerja diubah dari portal." />
          )
        ) : (
          <>
            <Table className="table-fixed">
              <colgroup>
                <col className="w-[96px]" />
                <col className="w-[140px]" />
                <col className="w-[168px]" />
                <col className="w-[136px]" />
                <col className="w-[164px]" />
                <col className="w-[88px]" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Status</Th>
                  <Th>Operasi</Th>
                  <Th>Pemicu</Th>
                  <Th>Waktu</Th>
                  <Th className="text-right">Durasi</Th>
                  <Th>Alasan</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const open = () => navigate(`/transaksi/${t.id}`)
                  const ms = txDuration(t)
                  return (
                    <Tr
                      key={t.id}
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) => e.key === 'Enter' && open()}
                      aria-label={`Buka transaksi ${t.id}`}
                      className="cursor-pointer hover:bg-surface"
                    >
                      <Td className="font-mono">{t.id}</Td>
                      <Td>
                        <TxStateBadge state={t.state} />
                      </Td>
                      <Td className="truncate">{opLabel(t.operation)}</Td>
                      <Td className="truncate">{t.requested_by.name}</Td>
                      <Td className="text-muted">
                        <TimeText iso={t.created_at} />
                      </Td>
                      <Td className="text-right font-mono">{ms !== null ? duration(ms) : '—'}</Td>
                      <Td className="truncate text-muted" title={reasonOf(t)}>
                        {reasonOf(t) || '—'}
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
                  {q.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  )
}
