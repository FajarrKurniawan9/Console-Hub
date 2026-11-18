import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { OrderStatusDot } from '../../../components/StatusDot'
import { TimeText } from '../../../components/TimeText'
import { Button } from '../../../components/ui/Button'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import type { Order } from '../../../lib/api/schemas'
import { rupiah } from '../../../lib/format'
import { useCan, useIsAdminView } from '../../../lib/permissions'
import { useUrlState } from '../../../lib/useUrlState'
import { ListFrame } from '../ListFrame'
import { useWorkList, workKeys } from '../queries'
import { OrderActions } from './OrderActions'
import { OrderForm } from './OrderForm'
import { orderTotal } from '../labels'

const STATUSES = [
  { value: 'ANTRE', label: 'Antre' },
  { value: 'SELESAI', label: 'Selesai' },
  { value: 'DIBATALKAN', label: 'Dibatalkan' },
]

const summary = (o: Order) => o.lines.map((l) => `${l.nama} × ${l.qty}`).join(', ')

export function PesananPage() {
  const url = useUrlState()
  const qc = useQueryClient()
  const can = useCan()
  const admin = useIsAdminView()
  const list = useWorkList('orders', url.get('q'), url.get('status'))
  const [creating, setCreating] = useState(false)
  const reload = () => void qc.invalidateQueries({ queryKey: workKeys.all('orders') })

  return (
    <>
      <ListFrame
        title="Pesanan"
        noun="pesanan"
        url={url}
        statuses={STATUSES}
        query={list}
        primary={
          can('pesanan.create') ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={16} strokeWidth={1.5} aria-hidden />
              Buat pesanan
            </Button>
          ) : null
        }
        emptyMessage={
          can('pesanan.create')
            ? 'Belum ada pesanan. Buat pesanan pertama dengan tombol Buat pesanan.'
            : 'Belum ada pesanan.'
        }
      >
        {(rows) => <OrderList rows={rows} admin={admin} onReload={reload} />}
      </ListFrame>
      {creating ? (
        <OrderForm
          onClose={() => setCreating(false)}
          onReload={() => {
            setCreating(false)
            reload()
          }}
        />
      ) : null}
    </>
  )
}

/** Shared by the Pesanan page and the User home (open orders). */
export function OrderList({
  rows,
  admin,
  onReload,
}: {
  rows: Order[]
  admin: boolean
  onReload: () => void
}) {
  return admin ? (
    <Table>
      <thead>
        <tr>
          <Th>No. pesanan</Th>
          <Th>Pelanggan</Th>
          <Th>Barang</Th>
          <Th className="text-right">Total</Th>
          <Th>Penanggung jawab</Th>
          <Th>Dibuat</Th>
          <Th>Status</Th>
          <Th className="text-right">Versi</Th>
          <Th>
            <span className="sr-only">Aksi</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <Tr key={o.id} className={o.status === 'DIBATALKAN' ? 'text-muted' : ''}>
            <Td className="font-mono">{o.order_no}</Td>
            <Td className="font-semibold">{o.customer}</Td>
            <Td className="max-w-64 truncate text-muted" title={summary(o)}>
              {summary(o)}
            </Td>
            <Td className="text-right">{rupiah(orderTotal(o))}</Td>
            <Td>{o.pic.name}</Td>
            <Td className="text-muted">
              <TimeText iso={o.created_at} mode="short" />
            </Td>
            <Td>
              <OrderStatusDot status={o.status} />
            </Td>
            <Td className="text-right font-mono">{o.version}</Td>
            <Td>
              <OrderActions order={o} onReload={onReload} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  ) : (
    <ul className="divide-y">
      {rows.map((o) => (
        <li
          key={o.id}
          className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${o.status === 'DIBATALKAN' ? 'text-muted' : ''}`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">
              {o.customer} <span className="font-normal text-muted">· {o.order_no}</span>
            </span>
            <span className="truncate text-dense text-muted">{summary(o)}</span>
            <span className="text-dense text-muted">
              {rupiah(orderTotal(o))} · {o.pic.name}
            </span>
          </div>
          <OrderStatusDot status={o.status} />
          <OrderActions order={o} onReload={onReload} />
        </li>
      ))}
    </ul>
  )
}
