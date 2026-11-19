import { useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { RowsSkeleton } from '../../components/Skeletons'
import { Panel, Section, Topbar } from '../../components/Topbar'
import { Table, Td, Th, Tr } from '../../components/ui/Table'
import { useDashboard } from '../../lib/api/hooks'
import { formatNumber } from '../../lib/format'
import { ItemDrawer } from '../items/ItemDrawer'
import { MovementRows, MovementHead } from '../stock/MovementTable'

export function DashboardPage() {
  const q = useDashboard()
  const navigate = useNavigate()
  const [itemId, setItemId] = useState<string | null>(null)

  const counts = q.data?.counts
  const stats: Array<[string, number | undefined, string]> = [
    ['Barang', counts?.items, '/barang'],
    ['Rak', counts?.racks, '/rak'],
    ['Reservasi aktif', counts?.active_reservations, '/reservasi?status=aktif'],
    ['Stok menipis', counts?.low_stock, '/barang?stock=low'],
  ]

  return (
    <>
      <Topbar title="Beranda" />
      <div className="flex flex-col gap-6 p-6">
        {q.isError ? (
          <Panel>
            <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
          </Panel>
        ) : (
          <>
            <Panel>
              <dl className="grid grid-cols-2 divide-x md:grid-cols-4">
                {stats.map(([label, n, to]) => (
                  <div key={label} className="flex flex-col gap-0.5 px-4 py-3">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd>
                      <button
                        type="button"
                        onClick={() => navigate(to)}
                        className="font-mono text-base font-semibold hover:text-accent hover:underline"
                        aria-label={`${label}: ${n ?? 'memuat'}. Buka daftar`}
                      >
                        {n === undefined ? '…' : formatNumber(n)}
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Section title="Stok menipis">
              <Panel>
                {q.isPending ? (
                  <RowsSkeleton rows={4} label="Memuat stok menipis" />
                ) : !q.data.low_stock.length ? (
                  <EmptyState message="Tidak ada barang dengan stok di bawah minimum." />
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>SKU</Th>
                        <Th>Nama</Th>
                        <Th num>Tersedia</Th>
                        <Th num>Minimum</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.data.low_stock.map((r) => (
                        <Tr key={r.item_id} onActivate={() => setItemId(r.item_id)}>
                          <Td className="font-mono text-[13px]">{r.sku}</Td>
                          <Td>{r.name}</Td>
                          <Td num className={r.available === 0 ? 'text-error' : 'text-warn'}>
                            {formatNumber(r.available)} {r.unit}
                          </Td>
                          <Td num>
                            {formatNumber(r.min_stock)} {r.unit}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Panel>
            </Section>

            <Section title="Pergerakan stok terakhir">
              <Panel>
                {q.isPending ? (
                  <RowsSkeleton rows={6} label="Memuat pergerakan stok" />
                ) : !q.data.recent_movements.length ? (
                  <EmptyState message="Belum ada pergerakan stok." />
                ) : (
                  <Table>
                    <MovementHead />
                    <tbody>
                      <MovementRows rows={q.data.recent_movements} onOpenItem={setItemId} />
                    </tbody>
                  </Table>
                )}
              </Panel>
            </Section>
          </>
        )}
      </div>
      <ItemDrawer itemId={itemId} onClose={() => setItemId(null)} />
    </>
  )
}
