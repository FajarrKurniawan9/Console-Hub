import type { Transaction, TxParticipant } from '../../../lib/api/schemas'
import type { Tone } from '../../../lib/status'

export const OPERATIONS: Record<string, string> = {
  'pesanan.create': 'Buat pesanan',
  'pesanan.complete': 'Selesaikan pesanan',
  'pesanan.cancel': 'Batalkan pesanan',
  'karyawan.create': 'Tambah karyawan',
  'karyawan.update': 'Ubah karyawan',
  'karyawan.deactivate': 'Nonaktifkan karyawan',
  'divisi.create': 'Tambah divisi',
  'divisi.update': 'Ubah divisi',
  'divisi.deactivate': 'Nonaktifkan divisi',
  'barang.create': 'Tambah barang',
  'barang.update': 'Ubah barang',
  'barang.deactivate': 'Nonaktifkan barang',
}
export const opLabel = (op: string) => OPERATIONS[op] ?? op

export const PREPARE: Record<TxParticipant['prepare_state'], { label: string; tone: Tone }> = {
  pending: { label: 'menunggu', tone: 'muted' },
  ok: { label: 'setuju', tone: 'ok' },
  refused: { label: 'menolak', tone: 'error' },
  error: { label: 'tidak terjangkau', tone: 'error' },
}

export const DECISION: Record<TxParticipant['decision_state'], { label: string; tone: Tone }> = {
  pending: { label: 'menunggu', tone: 'muted' },
  committed: { label: 'selesai', tone: 'ok' },
  aborted: { label: 'dibatalkan', tone: 'muted' },
  failed: { label: 'gagal', tone: 'error' },
}

/** "Commit" while committing/committed, "Batal" when the decision was to abort. */
export const decisionVerb = (t: Transaction) =>
  t.state === 'aborted' || t.state === 'aborting' ? 'Batal' : 'Commit'

/** Worst tone of a participant, for its box border. */
export function participantTone(p: TxParticipant): Tone {
  if (p.decision_state === 'failed' || p.prepare_state === 'refused' || p.prepare_state === 'error')
    return 'error'
  if (p.decision_state === 'committed') return 'ok'
  if (p.prepare_state === 'pending' || p.decision_state === 'pending') return 'accent'
  return 'muted'
}

export function txDuration(t: Transaction) {
  const end = t.finished_at ?? t.decided_at
  return end ? new Date(end).getTime() - new Date(t.created_at).getTime() : null
}

/** One line for the list: the failure reason, or the refusing consoles. */
export function reasonOf(t: Transaction) {
  if (t.failure_message) return t.failure_message
  const refused = t.participants.filter((p) => p.refusal_code)
  return refused.map((p) => `${p.console.name}: ${p.refusal_code}`).join(', ')
}
