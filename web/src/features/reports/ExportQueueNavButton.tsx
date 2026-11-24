import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useReportExports } from './queries'
import { ExportWaitingListModal } from './ExportWaitingListModal'

export function ExportQueueNavButton() {
  const [open, setOpen] = useState(false)
  const exportsQuery = useReportExports()
  const activeCount =
    exportsQuery.data?.filter((e) => e.status === 'pending' || e.status === 'processing').length ?? 0

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        title="Antrean Unduhan & Ekspor Scheduler"
        className="relative size-8 p-0"
        aria-label="Buka antrean ekspor"
      >
        <Inbox size={16} strokeWidth={1.8} aria-hidden />
        {activeCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-on-accent animate-pulse">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <ExportWaitingListModal open={open} onOpenChange={setOpen} />
    </>
  )
}
