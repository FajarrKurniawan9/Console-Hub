import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, ClipboardList, UsersRound, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../components/PageHeader'
import { RowsSkeleton } from '../../components/Skeletons'
import { Button } from '../../components/ui/Button'
import { listOf } from '../../lib/api/work'
import { useCan } from '../../lib/permissions'
import { useAuth } from '../auth/auth'
import { OrderForm } from './pesanan/OrderForm'
import { OrderList } from './pesanan/PesananPage'
import { workKeys } from './queries'

function Shortcut({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="flex h-14 items-center gap-3 rounded-md border bg-bg px-4 font-semibold transition-colors duration-150 hover:bg-surface"
    >
      <Icon size={16} strokeWidth={1.5} aria-hidden className="text-muted" />
      {label}
    </Link>
  )
}

/** User home: the one main action, shortcuts the role allows, and open orders. */
export function UserHomePage() {
  const { user } = useAuth()
  const can = useCan()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const open = useQuery({
    queryKey: [...workKeys.all('orders'), 'home'],
    queryFn: () => listOf('orders', { status: 'ANTRE', limit: 10 }),
    enabled: can('pesanan.view'),
  })
  const reload = () => void qc.invalidateQueries({ queryKey: workKeys.all('orders') })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Halo, ${user?.name.split(' ')[0] ?? ''}`}
        actions={
          can('pesanan.create') ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <ClipboardList size={16} strokeWidth={1.5} aria-hidden />
              Buat pesanan
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {can('pesanan.view') ? (
          <Shortcut to="/pesanan" icon={ClipboardList} label="Lihat pesanan" />
        ) : null}
        {can('barang.view') ? <Shortcut to="/barang" icon={Boxes} label="Cek stok barang" /> : null}
        {can('karyawan.view') ? (
          <Shortcut to="/karyawan" icon={UsersRound} label="Data karyawan" />
        ) : null}
      </div>

      {can('pesanan.view') ? (
        <Section
          title="Pesanan yang masih antre"
          aside={
            <Link
              to="/pesanan?status=ANTRE"
              className="text-dense text-accent underline-offset-4 hover:underline"
            >
              Semua pesanan antre
            </Link>
          }
        >
          <Panel>
            {open.isPending ? (
              <RowsSkeleton rows={4} label="Memuat pesanan" />
            ) : open.isError ? (
              <ErrorState
                error={open.error}
                onRetry={() => void open.refetch()}
                retrying={open.isFetching}
              />
            ) : open.data.data.length === 0 ? (
              <EmptyState message="Tidak ada pesanan yang antre. Semua pesanan sudah selesai atau dibatalkan." />
            ) : (
              <OrderList rows={open.data.data} admin={false} onReload={reload} />
            )}
          </Panel>
        </Section>
      ) : null}

      {creating ? (
        <OrderForm
          onClose={() => setCreating(false)}
          onReload={() => {
            setCreating(false)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}
