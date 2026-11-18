import { CheckCheck, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Button } from '../../../components/ui/Button'
import type { Order } from '../../../lib/api/schemas'
import { useCan } from '../../../lib/permissions'
import { workKeys } from '../queries'
import { useWrite } from '../useWrite'
import { WriteFeedback } from '../WriteFeedback'

const COPY = {
  complete: {
    button: 'Selesaikan',
    title: (o: Order) => `Selesaikan ${o.order_no}?`,
    body: 'Pesanan ditandai selesai dan keluar dari antrean produksi.',
    busy: 'Menyelesaikan…',
    done: (o: Order) => `${o.order_no} diselesaikan`,
  },
  cancel: {
    button: 'Batalkan',
    title: (o: Order) => `Batalkan ${o.order_no}?`,
    body: 'Pesanan dibatalkan dan stok yang dipesan dikembalikan ke gudang. Tindakan ini tidak dapat diurungkan.',
    busy: 'Membatalkan…',
    done: (o: Order) => `${o.order_no} dibatalkan`,
  },
} as const

/** Selesaikan / Batalkan on an ANTRE order, each behind a confirmation and its permission. */
export function OrderActions({ order, onReload }: { order: Order; onReload: () => void }) {
  const can = useCan()
  const write = useWrite()
  const [action, setAction] = useState<keyof typeof COPY | null>(null)
  if (order.status !== 'ANTRE') return null
  const allowed = {
    complete: can('pesanan.complete'),
    cancel: can('pesanan.cancel'),
  }
  if (!allowed.complete && !allowed.cancel) return null
  const close = () => {
    if (write.busy) return
    write.reset()
    setAction(null)
  }
  const c = action ? COPY[action] : null
  return (
    <div className="flex justify-end gap-1">
      {allowed.complete ? (
        <Button
          variant="ghost"
          onClick={() => setAction('complete')}
          aria-label={`Selesaikan ${order.order_no}`}
        >
          <CheckCheck size={16} strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">Selesaikan</span>
        </Button>
      ) : null}
      {allowed.cancel ? (
        <Button
          variant="ghost"
          onClick={() => setAction('cancel')}
          aria-label={`Batalkan ${order.order_no}`}
        >
          <X size={16} strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">Batalkan</span>
        </Button>
      ) : null}
      {action && c ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={c.title(order)}
          description={`${order.customer} · ${order.pic.name}`}
          confirmLabel={c.button}
          busyLabel={write.outcome.kind === 'finishing' ? 'Sedang diselesaikan…' : c.busy}
          danger={action === 'cancel'}
          busy={write.busy}
          onConfirm={() =>
            void write.run(
              {
                method: 'POST',
                url: `/orders/${order.id}/${action}`,
                data: { expected_version: order.version },
              },
              {
                success: c.done(order),
                // Cancel releases stock, so items change too.
                invalidate: [workKeys.all('orders'), workKeys.all('items')],
                onDone: () => setAction(null),
              },
            )
          }
        >
          <p>{c.body}</p>
          <WriteFeedback
            outcome={write.outcome}
            onReload={() => {
              write.reset()
              setAction(null)
              onReload()
            }}
            onDismiss={write.reset}
          />
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
