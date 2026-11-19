import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { RESOURCES, type Resource } from '../../lib/api/work'
import { workKeys } from './queries'
import { useWrite } from './useWrite'
import { WriteFeedback } from './WriteFeedback'

/** Confirm → DELETE ?expected_version= (deactivates) → result in the same dialog. */
export function useDeactivate(resource: Resource, noun: string, onReload: () => void) {
  const write = useWrite(resource)
  const [target, setTarget] = useState<{ id: string; label: string; version: number } | null>(null)
  const close = () => {
    if (write.busy) return
    write.reset()
    setTarget(null)
  }
  const dialog = target ? (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && close()}
      title={`Nonaktifkan ${target.label}?`}
      description={`${noun[0]!.toUpperCase()}${noun.slice(1)} ini tidak dapat dipilih lagi untuk data baru. Data lamanya tetap tersimpan.`}
      confirmLabel="Nonaktifkan"
      busyLabel="Menonaktifkan…"
      danger
      busy={write.busy}
      onConfirm={() =>
        void write.run(
          {
            method: 'DELETE',
            url: `${RESOURCES[resource].path}/${target.id}?expected_version=${target.version}`,
          },
          {
            success: `${target.label} dinonaktifkan`,
            invalidate: [workKeys.root],
            onDone: () => setTarget(null),
          },
        )
      }
    >
      <WriteFeedback
        outcome={write.outcome}
        onReload={() => {
          write.reset()
          setTarget(null)
          onReload()
        }}
        onDismiss={write.reset}
      />
    </ConfirmDialog>
  ) : null
  return { ask: setTarget, dialog }
}
