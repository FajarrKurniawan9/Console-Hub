import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { RowsSkeleton } from '../../components/Skeletons'
import { StatusDot } from '../../components/StatusDot'
import { Section } from '../../components/Topbar'
import { Drawer } from '../../components/ui/Dialog'
import { Table, Td, Th } from '../../components/ui/Table'
import { useItem, useMovements } from '../../lib/api/hooks'
import { formatNumber } from '../../lib/format'
import { KIND_LABEL, STOCK_LEVEL } from '../../lib/labels'
import { stockLevel } from '../../lib/stock'
import { AdjustButton } from '../stock/AdjustButton'
import { MovementHead, MovementRows } from '../stock/MovementTable'

/** Detail barang (baca saja) + pintu ke penyesuaian stok. */
export function ItemDrawer({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  return (
    <Drawer
      open={!!itemId}
      onOpenChange={(o) => !o && onClose()}
      title="Detail barang"
      description="Data barang dikelola dari Console Hub."
    >
      {itemId ? <ItemDetailBody id={itemId} /> : null}
    </Drawer>
  )
}

function ItemDetailBody({ id }: { id: string }) {
  const q = useItem(id)
  const moves = useMovements({ item_id: id })

  if (q.isPending) return <RowsSkeleton rows={5} label="Memuat detail barang" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
  const it = q.data
  const level = STOCK_LEVEL[stockLevel(it.stock.available, it.min_stock)]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[13px] text-muted">{it.sku}</p>
            <p className="text-base font-semibold">{it.name}</p>
          </div>
          <AdjustButton item={it} />
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-y-1.5">
          <dt className="text-muted">Jenis</dt>
          <dd>{KIND_LABEL[it.kind]}</dd>
          <dt className="text-muted">Satuan</dt>
          <dd>{it.unit}</dd>
          <dt className="text-muted">Stok minimum</dt>
          <dd className="font-mono text-[13px]">{formatNumber(it.min_stock)}</dd>
          <dt className="text-muted">Status stok</dt>
          <dd className="flex flex-wrap gap-3">
            <StatusDot {...level} />
            {it.locked ? <StatusDot tone="warn" label="Ditahan" /> : null}
            {it.status === 'nonaktif' ? <StatusDot tone="neutral" label="Barang nonaktif" /> : null}
          </dd>
        </dl>
        {it.locked ? (
          <p className="rounded-sm border bg-panel px-3 py-2 text-muted">
            Barang ini sedang diproses oleh sistem lain. Coba lagi sebentar lagi.
          </p>
        ) : null}
      </div>

      <Section title="Stok per rak">
        <div className="rounded-sm border">
          {!it.racks.length ? (
            <EmptyState message="Barang ini belum punya stok di rak mana pun." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Rak</Th>
                  <Th num>Ada</Th>
                  <Th num>Direservasi</Th>
                  <Th num>Tersedia</Th>
                </tr>
              </thead>
              <tbody>
                {it.racks.map((r) => (
                  <tr key={r.rack_id}>
                    <Td>
                      <span className="font-mono text-[13px]">{r.rack_code}</span>{' '}
                      <span className="text-muted">{r.rack_name}</span>
                    </Td>
                    <Td num>{formatNumber(r.on_hand)}</Td>
                    <Td num>{formatNumber(r.reserved)}</Td>
                    <Td num>{formatNumber(r.available)}</Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td num>{formatNumber(it.stock.on_hand)}</Td>
                  <Td num>{formatNumber(it.stock.reserved)}</Td>
                  <Td num>{formatNumber(it.stock.available)}</Td>
                </tr>
              </tbody>
            </Table>
          )}
        </div>
      </Section>

      <Section title="Pergerakan terakhir">
        <div className="rounded-sm border">
          {moves.isPending ? (
            <RowsSkeleton rows={4} label="Memuat pergerakan" />
          ) : moves.isError ? (
            <ErrorState error={moves.error} onRetry={() => void moves.refetch()} />
          ) : !moves.rows?.length ? (
            <EmptyState message="Belum ada pergerakan untuk barang ini." />
          ) : (
            <Table>
              <MovementHead compact />
              <tbody>
                <MovementRows rows={moves.rows.slice(0, 10)} compact />
              </tbody>
            </Table>
          )}
        </div>
      </Section>
    </div>
  )
}
