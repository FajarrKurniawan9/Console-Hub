import clsx from 'clsx'
import { Td, Th, Tr } from '../../components/ui/Table'
import type { StockMovement } from '../../lib/api/types'
import { formatDateTime, formatNumber, formatSigned } from '../../lib/format'
import { MOVEMENT } from '../../lib/labels'

export function MovementHead({ compact }: { compact?: boolean }) {
  return (
    <thead>
      <tr>
        <Th>Waktu</Th>
        {compact ? null : <Th>Barang</Th>}
        <Th>Rak</Th>
        <Th>Jenis</Th>
        <Th num>Jumlah</Th>
        <Th num>Saldo</Th>
        <Th>Keterangan</Th>
      </tr>
    </thead>
  )
}

export function MovementRows({
  rows,
  compact,
  onOpenItem,
}: {
  rows: StockMovement[]
  compact?: boolean
  onOpenItem?: (itemId: string) => void
}) {
  return rows.map((m) => (
    <Tr key={m.id} onActivate={onOpenItem ? () => onOpenItem(m.item_id) : undefined}>
      <Td className="whitespace-nowrap text-muted">{formatDateTime(m.occurred_at)}</Td>
      {compact ? null : (
        <Td>
          <span className="font-mono text-[13px]">{m.sku}</span>{' '}
          <span className="text-muted">{m.item_name}</span>
        </Td>
      )}
      <Td className="font-mono text-[13px]">{m.rack_code ?? '—'}</Td>
      <Td className="whitespace-nowrap">{MOVEMENT[m.type]}</Td>
      <Td num className={clsx(m.quantity > 0 && 'text-ok', m.quantity < 0 && 'text-error')}>
        {formatSigned(m.quantity)}
      </Td>
      <Td num>{formatNumber(m.balance_after)}</Td>
      <Td className="max-w-72 truncate text-muted" title={m.reason ?? m.order_code ?? undefined}>
        {m.order_code ? <span className="font-mono text-[13px]">{m.order_code}</span> : m.reason}
        {m.actor ? <span> · {m.actor}</span> : null}
      </Td>
    </Tr>
  ))
}
