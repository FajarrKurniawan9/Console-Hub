import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCw,
} from 'lucide-react'
import { TimeText } from '../../components/TimeText'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import type { ReportExport } from '../../lib/api/schemas'
import { downloadExportFile, useReportExports } from './queries'

export function ExportWaitingListModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const exportsQuery = useReportExports()
  const items = exportsQuery.data ?? []
  const hasActive = items.some((e) => e.status === 'pending' || e.status === 'processing')
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  async function handleDownload(item: ReportExport) {
    setDownloadingId(item.id)
    try {
      await downloadExportFile(item)
    } finally {
      setDownloadingId(null)
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
      description="Sistem memproses ekspor laporan di background via Scheduler antrean. Tombol download otomatis muncul setelah status selesai."
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-muted pb-1 border-b">
          <span>
            {items.length} riwayat antrean ·{' '}
            {hasActive ? 'Memperbarui otomatis tiap 2s' : 'Terbaru di atas'}
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

        {exportsQuery.isPending ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
            <Spinner />
            <p className="mt-2 text-xs">Memuat antrean ekspor…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted gap-2">
            <Clock size={28} strokeWidth={1.5} className="opacity-40" />
            <p className="text-xs">Belum ada permintaan ekspor di antrean.</p>
            <p className="text-[11px] text-muted/80">
              Gunakan tombol &quot;Export Data&quot; di halaman Audit, Log, atau Barang untuk membuat tiket baru.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border bg-surface/30 p-3 transition-colors hover:bg-surface/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                      {item.format === 'csv' || item.format === 'xlsx' ? (
                        <FileSpreadsheet size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-xs font-semibold text-fg">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-muted">
                        Format: <span className="uppercase font-mono">{item.format}</span> · Dibuat <TimeText iso={item.created_at} />
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {item.status === 'pending' ? (
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
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-[11px] font-medium text-error border border-error/20">
                        <AlertCircle size={11} />
                        Gagal
                      </span>
                    )}
                  </div>
                </div>

                {/* Status description or download action */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                  {item.status === 'pending' ? (
                    <span className="text-muted flex items-center gap-1">
                      <span className="size-1 rounded-full bg-amber-500" />
                      Menunggu giliran antrean scheduler...
                    </span>
                  ) : item.status === 'processing' ? (
                    <span className="text-blue-600 flex items-center gap-1 font-medium">
                      <span className="size-1 rounded-full bg-blue-500 animate-ping" />
                      Sedang mengekstrak baris data di background...
                    </span>
                  ) : item.status === 'completed' ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-muted text-[11px]">
                        Selesai diproses · Siap disimpan
                      </span>
                      <Button
                        variant="primary"
                        onClick={() => void handleDownload(item)}
                        disabled={downloadingId === item.id}
                        className="h-7 text-xs px-2.5"
                      >
                        {downloadingId === item.id ? (
                          <Spinner />
                        ) : (
                          <Download size={13} strokeWidth={2} />
                        )}
                        Unduh {item.format.toUpperCase()}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-error">
                      {item.error_message || 'Terjadi kesalahan saat memproses ekspor.'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </div>
      </div>
    </Modal>
  )
}
