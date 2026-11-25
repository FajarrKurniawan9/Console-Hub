import { useState } from 'react'
import { Download, Inbox } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../auth/auth'
import { canExportType, useReportExports } from './queries'
import { ExportModal } from './ExportModal'
import { ExportWaitingListModal } from './ExportWaitingListModal'

export function ExportAction({
  type,
  title,
  filterSummary,
  filters,
}: {
  type: 'audit' | 'logs' | 'barang'
  title: string
  filterSummary?: string
  filters?: unknown
}) {
  const { user } = useAuth()
  const allowed = canExportType(user, type)

  const [openExport, setOpenExport] = useState(false)
  const [openQueue, setOpenQueue] = useState(false)

  const exportsQuery = useReportExports(allowed)
  const activeCount =
    exportsQuery.data?.filter((e) => e.status === 'pending' || e.status === 'processing').length ?? 0

  if (!allowed) return null

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          onClick={() => setOpenQueue(true)}
          title="Lihat status antrean unduhan scheduler"
          className="relative"
        >
          <Inbox size={15} strokeWidth={1.7} aria-hidden />
          <span className="hidden sm:inline">Daftar Unduhan</span>
          {activeCount > 0 ? (
            <span className="flex size-4.5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-on-accent animate-pulse">
              {activeCount}
            </span>
          ) : null}
        </Button>

        <Button
          variant="secondary"
          onClick={() => setOpenExport(true)}
          title={`Export data ${title} ke background scheduler`}
        >
          <Download size={15} strokeWidth={1.7} aria-hidden />
          <span>Export Data</span>
        </Button>
      </div>

      <ExportModal
        open={openExport}
        onOpenChange={setOpenExport}
        type={type}
        title={title}
        filterSummary={filterSummary}
        filters={filters}
        onSuccess={() => setOpenQueue(true)}
      />

      <ExportWaitingListModal open={openQueue} onOpenChange={setOpenQueue} />
    </>
  )
}
