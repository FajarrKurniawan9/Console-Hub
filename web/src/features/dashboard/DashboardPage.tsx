import { Activity, Boxes, PackageCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { PageHeader, Panel, Section } from '../../components/PageHeader'
import { CardsSkeleton, RowsSkeleton } from '../../components/Skeletons'
import { Button } from '../../components/ui/Button'
import { number } from '../../lib/format'
import { KindChart } from './KindChart'
import { useItemDashboard } from './queries'
import { TrendChart } from './TrendChart'

const PRESET_RANGES = [
  { days: 7, label: '7 Hari' },
  { days: 14, label: '14 Hari' },
  { days: 30, label: '30 Hari' },
] as const

export function DashboardPage() {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [days, setDays] = useState<number>(7)
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().slice(0, 10)
  })
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().slice(0, 10))

  const filter = useMemo(() => {
    if (mode === 'custom') {
      return { from: customFrom, to: customTo }
    }
    return { days }
  }, [mode, customFrom, customTo, days])

  const q = useItemDashboard(filter)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard transaksi"
        meta="Ringkasan dan visualisasi tren transaksi inventaris barang."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Rentang waktu" className="flex items-center gap-1">
              {PRESET_RANGES.map((r) => (
                <Button
                  key={r.days}
                  variant={mode === 'preset' && days === r.days ? 'primary' : 'secondary'}
                  onClick={() => {
                    setMode('preset')
                    setDays(r.days)
                  }}
                  aria-pressed={mode === 'preset' && days === r.days}
                >
                  {r.label}
                </Button>
              ))}
              <Button
                variant={mode === 'custom' ? 'primary' : 'secondary'}
                onClick={() => setMode('custom')}
                aria-pressed={mode === 'custom'}
              >
                Kustom
              </Button>
            </div>

            {mode === 'custom' ? (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted">Dari:</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg focus:border-accent focus:outline-hidden"
                />
                <span className="text-muted">Sampai:</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg focus:border-accent focus:outline-hidden"
                />
              </div>
            ) : null}
          </div>
        }
      />

      {/* KPI Summary Cards */}
      {q.isPending ? (
        <CardsSkeleton />
      ) : q.isError ? (
        <Panel>
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="Total barang terdaftar"
            value={number(q.data.total_items)}
            detail="Barang dalam status aktif"
            icon={Boxes}
          />
          <KpiCard
            label="Total kuantitas stok"
            value={number(q.data.total_quantity)}
            detail="Akumulasi stok seluruh jenis"
            icon={PackageCheck}
          />
          <KpiCard
            label={mode === 'custom' ? 'Transaksi (Kustom)' : `Transaksi (${days} hari)`}
            value={number(q.data.transactions_count)}
            detail="Aktivitas buat, ubah, dan nonaktifkan"
            icon={Activity}
          />
        </div>
      )}

      {/* Trend Chart */}
      <Section
        title="Tren Aktivitas Barang (Harian)"
        aside={
          <span className="text-xs text-muted">
            {mode === 'custom' ? `${customFrom} s/d ${customTo}` : `${days} hari terakhir`}
          </span>
        }
      >
        <Panel className="p-4">
          {q.isPending ? (
            <RowsSkeleton rows={4} label="Memuat grafik tren transaksi" />
          ) : q.isError ? null : (
            <TrendChart points={q.data.activity_trend} />
          )}
        </Panel>
      </Section>

      {/* Kind Distribution Chart */}
      <Section title="Distribusi Stok Berdasarkan Jenis Barang">
        <Panel className="p-4">
          {q.isPending ? (
            <RowsSkeleton rows={4} label="Memuat distribusi jenis barang" />
          ) : q.isError ? null : (
            <KindChart items={q.data.kind_distribution} />
          )}
        </Panel>
      </Section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Boxes
}) {
  return (
    <Panel className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-dense font-medium">{label}</span>
        <Icon size={18} strokeWidth={1.5} aria-hidden />
      </div>
      <div className="text-2xl font-bold tabular-nums text-fg">{value}</div>
      <span className="text-xs text-muted">{detail}</span>
    </Panel>
  )
}
