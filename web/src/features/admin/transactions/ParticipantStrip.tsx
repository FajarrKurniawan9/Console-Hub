import clsx from 'clsx'
import { Dot } from '../../../components/StatusDot'
import type { Transaction } from '../../../lib/api/schemas'
import { DECISION, decisionVerb, participantTone, PREPARE } from './labels'

const BORDER = {
  ok: 'border-ok',
  warn: 'border-warn',
  error: 'border-error',
  muted: 'border',
  accent: 'border-accent',
}

/** Three boxes (HR, Gudang, Produksi): prepare answer and decision, as dot + word. */
export function ParticipantStrip({ tx }: { tx: Transaction }) {
  const verb = decisionVerb(tx)
  return (
    <ol aria-label="Fase per console" className="grid gap-3 sm:grid-cols-3">
      {tx.participants.map((p) => {
        const tone = participantTone(p)
        const busy = tone === 'accent'
        return (
          <li
            key={p.console.slug}
            className={clsx('flex flex-col gap-1.5 rounded-md border bg-bg p-3', BORDER[tone])}
          >
            <span className="font-semibold">{p.console.name}</span>
            <span className="flex items-center justify-between gap-2 text-dense">
              <span className="text-muted">Prepare</span>
              <Dot {...PREPARE[p.prepare_state]} pulse={busy && p.prepare_state === 'pending'} />
            </span>
            <span className="flex items-center justify-between gap-2 text-dense">
              <span className="text-muted">{verb}</span>
              <Dot {...DECISION[p.decision_state]} pulse={busy && p.decision_state === 'pending'} />
            </span>
          </li>
        )
      })}
    </ol>
  )
}
