import { useState } from 'react'
import {
  AlertCircle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCw,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { TimeText } from '../../components/TimeText'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError } from '../../lib/api/client'
import type { ReportExport } from '../../lib/api/schemas'
import { number } from '../../lib/format'
import {
  describeSchedule,
  downloadExportFile,
  useCancelExport,
  useReportExports,
} from './queries'

type QueueFilter = 'all' | 'active' | 'scheduled' | 'history'

export function ExportWaitingListModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const exportsQuery = useReportExports(open, open)
  const cancelExport = useCancelExport()
  const items = exportsQuery.data ?? []

  const activeItems = items.filter((e) => e.status === 'pending' || e.status === 'processing')
  const scheduledItems = items.filter((e) => e.status === 'scheduled')
  const historyItems = items.filter(
    (e) => e.status === 'completed' || e.status === 'failed' || e.status === 'cancelled',
  )

  const hasActive = activeItems.length > 0
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const visibleItems =
    filter === 'active'
      ? activeItems
      : filter === 'scheduled'
        ? scheduledItems
        : filter === 'history'
          ? historyItems
          : items

  const tabs: { id: QueueFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: items.length },
    { id: 'active', label: 'Antrean', count: activeItems.length },
    { id: 'scheduled', label: 'Terjadwal', count: scheduledItems.length },
    { id: 'history', label: 'Riwayat', count: historyItems.length },
  ]

  async function handleDownload(item: ReportExport) {
    setDownloadingId(item.id)
    try {
      await downloadExportFile(item)
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal mengunduh file ekspor.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleCancel(item: ReportExport) {
    setCancellingId(item.id)
    try {
      await cancelExport.mutateAsync(item.id)
      toast.success(
        item.status === 'scheduled' ? 'Jadwal ekspor dibatalkan.' : 'Tiket ekspor dibatalkan.',
      )
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal membatalkan ekspor.')
      void exportsQuery.refetch()
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <span>Antrean Ekspor & Unduhan</span>
          {hasActive ? (
            <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
              <span className="size-1.5 rounded-full bg-blue-500 animate-ping" />
              Live Polling
            </span>
          ) : null}
        </div>
      }
      description="Antrean aktif diproses bergiliran (FIFO) oleh backend Queue & Scheduler. Jadwal otomatis dan riwayat selesai bersifat privat untuk masing-masing pemohon."
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-muted pb-1 border-b">
          <span>
            {items.length} item
            {scheduledItems.length > 0 ? ` (${scheduledItems.length} terjadwal)` : ''} ·{' '}
            {hasActive ? 'Memperbarui otomatis tiap 2,5 dtk' : 'Terbaru di atas'}
          </span>
          <button
            type="button"
            onClick={() => void exportsQuery.refetch()}
            disabled={exportsQuery.isFetching}
            className="inline-flex items-center gap-1 text-muted hover:text-fg disabled:opacity-50"
          >
            <RotateCw
              size={12}
              className={exportsQuery.isFetching ? 'animate-spin' : ''}
              aria-hidden
            />
            Segarkan
          </button>
        </div>

        {items.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status ekspor">
            {tabs.map((tab) => {
              const selected = filter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(tab.id)}
                  className={
                    selected
                      ? 'inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent'
                      : 'inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2.5 py-0.5 text-[11px] text-muted hover:text-fg'
                  }
                >
                  <span>
                    {tab.label} ({tab.count})
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}

        {exportsQuery.isPending ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
            <Spinner />
            <p className="mt-2 text-xs">Memuat antrean ekspor…</p>
          </div>
        ) : exportsQuery.isError ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-error/30 bg-error/5 py-6 px-4 text-center"
          >
            <AlertCircle size={24} className="text-error" aria-hidden />
            <p className="text-xs font-semibold text-fg">Gagal memuat antrean ekspor dari server.</p>
            <p className="text-[11px] text-muted">
              {exportsQuery.error instanceof ApiError
                ? exportsQuery.error.message
                : 'Periksa koneksi ke portal lalu coba lagi.'}
            </p>
            <Button
              variant="secondary"
              onClick={() => void exportsQuery.refetch()}
              disabled={exportsQuery.isFetching}
              className="mt-1 h-7 text-xs px-3"
            >
              {exportsQuery.isFetching ? <Spinner /> : <RotateCw size={12} aria-hidden />}
              Coba lagi
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted gap-2">
            <Clock size={28} strokeWidth={1.5} className="opacity-40" />
            <p className="text-xs">Belum ada permintaan ekspor di antrean.</p>
            <p className="text-[11px] text-muted/80">
              Gunakan tombol &quot;Export Data&quot; di halaman Audit, Log, atau Barang untuk membuat tiket baru.
            </p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted">
            <p className="text-xs">Tidak ada item pada kategori ini.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {visibleItems.map((item) => {
              const isMine = item.is_mine !== false
              const isActive = item.status === 'pending' || item.status === 'processing'
              const isCancellable =
                isMine && (item.status === 'scheduled' || item.status === 'pending')
              const recurringSummary = describeSchedule(item)

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border bg-surface/30 p-3 transition-colors hover:bg-surface/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                        {item.format === 'csv' || item.format === 'xlsx' ? (
                          <FileSpreadsheet size={16} />
                        ) : item.format === 'json' ? (
                          <FileCode size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isActive && item.queue_position != null ? (
                            <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.2 text-[10px] font-mono font-bold text-accent">
                              #{item.queue_position}
                            </span>
                          ) : null}
                          <span className="truncate text-xs font-semibold text-fg">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted">
                          Format: <span className="uppercase font-mono">{item.format}</span>
                          {item.requester_name ? <> · {item.requester_name}</> : null}
                          {item.parent_export_id != null ? <> · Jadwal otomatis</> : null} · Dibuat{' '}
                          <TimeText iso={item.created_at} />
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {item.status === 'scheduled' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 border border-indigo-500/20">
                          <CalendarClock size={11} />
                          Terjadwal
                        </span>
                      ) : item.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 border border-amber-500/20">
                          <Clock size={11} className="animate-pulse" />
                          Waiting List
                        </span>
                      ) : item.status === 'processing' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 border border-blue-500/20">
                          <Loader2 size={11} className="animate-spin" />
                          Scheduler Berjalan
                        </span>
                      ) : item.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 border border-green-500/20">
                          <CheckCircle2 size={11} />
                          Siap Diunduh
                        </span>
                      ) : item.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted border border-border">
                          <Ban size={11} />
                          Dibatalkan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-[11px] font-medium text-error border border-error/20">
                          <AlertCircle size={11} />
                          Gagal
                        </span>
                      )}

                      {!isMine ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                          <Users size={10} aria-hidden />
                          Antrean pengguna lain
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Status description or action */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                    {item.status === 'scheduled' ? (
                      <>
                        <span className="text-muted flex items-center gap-1 flex-wrap min-w-0">
                          <CalendarClock size={11} className="shrink-0" aria-hidden />
                          {recurringSummary ? <span>{recurringSummary} ·</span> : null}
                          {item.scheduled_at ? (
                            <>
                              {recurringSummary ? 'Berikutnya ' : 'Dijadwalkan '}
                              <TimeText iso={item.scheduled_at} />
                              {item.cron_expression ? ` (${item.cron_expression})` : ''}
                            </>
                          ) : (
                            'Menunggu jadwal eksekusi...'
                          )}
                        </span>
                        {isCancellable ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleCancel(item)}
                            disabled={cancellingId === item.id}
                            className="h-7 text-xs px-2.5 shrink-0"
                          >
                            {cancellingId === item.id ? <Spinner /> : <Ban size={12} aria-hidden />}
                            Batalkan
                          </Button>
                        ) : null}
                      </>
                    ) : item.status === 'pending' ? (
                      <>
                        <span className="text-muted flex items-center gap-1">
                          <span className="size-1 rounded-full bg-amber-500" />
                          {isMine
                            ? 'Menunggu giliran antrean scheduler...'
                            : 'Sedang menunggu giliran di antrean bersama...'}
                        </span>
                        {isCancellable ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleCancel(item)}
                            disabled={cancellingId === item.id}
                            className="h-7 text-xs px-2.5 shrink-0"
                          >
                            {cancellingId === item.id ? <Spinner /> : <Ban size={12} aria-hidden />}
                            Batalkan
                          </Button>
                        ) : null}
                      </>
                    ) : item.status === 'processing' ? (
                      <span className="text-blue-600 flex items-center gap-1 font-medium">
                        <span className="size-1 rounded-full bg-blue-500 animate-ping" />
                        {isMine
                          ? 'Sedang mengekstrak baris data di background...'
                          : 'Sedang diproses oleh background worker...'}
                      </span>
                    ) : item.status === 'completed' ? (
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="text-muted text-[11px]">
                          {item.row_count != null
                            ? `${number(item.row_count)} baris · Siap disimpan`
                            : 'Selesai diproses · Siap disimpan'}
                        </span>
                        {isMine ? (
                          <Button
                            variant="primary"
                            onClick={() => void handleDownload(item)}
                            disabled={downloadingId === item.id}
                            className="h-7 text-xs px-2.5 shrink-0"
                          >
                            {downloadingId === item.id ? (
                              <Spinner />
                            ) : (
                              <Download size={13} strokeWidth={2} />
                            )}
                            Unduh {item.format.toUpperCase()}
                          </Button>
                        ) : null}
                      </div>
                    ) : item.status === 'cancelled' ? (
                      <span className="text-muted">
                        {item.error_message ||
                          (item.cancelled_at ? (
                            <>
                              Dibatalkan pada <TimeText iso={item.cancelled_at} />
                            </>
                          ) : (
                            'Permintaan ekspor telah dibatalkan.'
                          ))}
                      </span>
                    ) : (
                      <span className="text-error">
                        {item.error_message || 'Terjadi kesalahan saat memproses ekspor.'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </div>
      </div>
    </Modal>
  )
}
