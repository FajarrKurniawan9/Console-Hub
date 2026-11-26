import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../auth/auth'
import { ExportWaitingListModal } from './ExportWaitingListModal'
import { useExportNotifications } from './notifications'
import { canAccessExportQueue, useReportExports } from './queries'

export function ExportQueueNavButton() {
  const { user } = useAuth()
  const allowed = canAccessExportQueue(user)
  const [open, setOpen] = useState(false)
  const exportsQuery = useReportExports(allowed)
  const { unreadReadyCount } = useExportNotifications(exportsQuery.data, allowed)
  const activeCount =
    exportsQuery.data?.filter((e) => e.status === 'pending' || e.status === 'processing').length ?? 0

  if (!allowed) return null

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        title={
          unreadReadyCount > 0
            ? `${unreadReadyCount} ekspor selesai dan siap diunduh`
            : 'Antrean Unduhan & Ekspor Scheduler'
        }
        className="relative size-8 p-0"
        aria-label={
          unreadReadyCount > 0
            ? `Buka antrean ekspor (${unreadReadyCount} unduhan siap)`
            : 'Buka antrean ekspor'
        }
      >
        <Inbox size={16} strokeWidth={1.8} aria-hidden />
        {activeCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-on-accent animate-pulse">
            {activeCount}
          </span>
        ) : null}
        {unreadReadyCount > 0 ? (
          <span
            data-testid="export-ready-dot"
            aria-hidden
            className={
              activeCount > 0
                ? 'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-ok ring-2 ring-bg'
                : 'absolute top-0.5 right-0.5 size-2.5 rounded-full bg-ok ring-2 ring-bg'
            }
          />
        ) : null}
      </Button>

      <ExportWaitingListModal open={open} onOpenChange={setOpen} />
    </>
  )
}
