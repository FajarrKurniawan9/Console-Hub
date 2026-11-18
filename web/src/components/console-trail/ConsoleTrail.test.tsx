import { describe, expect, it } from 'vitest'
import type { Transaction, TxParticipant } from '../../lib/api/schemas'
import {
  byConsoleOrder,
  responseMs,
  rowStatus,
  trailSummary,
  userTrailMessage,
} from './useTransactionTrail'

// Pure logic only: no mock server, no rendering.

const T0 = '2026-11-18T10:00:00.000Z'
const at = (ms: number) => new Date(Date.parse(T0) + ms).toISOString()

function p(slug: 'hr' | 'gudang' | 'produksi', patch: Partial<TxParticipant> = {}): TxParticipant {
  const name = { hr: 'HR', gudang: 'Gudang', produksi: 'Produksi' }[slug]
  return {
    console: { slug, name },
    prepare_state: 'ok',
    decision_state: 'committed',
    attempts: 2,
    last_error: null,
    prepared_at: at(300),
    finished_at: at(900),
    ...patch,
  }
}

function tx(state: Transaction['state'], participants: TxParticipant[]): Transaction {
  return {
    id: 'tx_0099',
    operation: 'karyawan.update',
    entity_type: 'karyawan',
    entity_id: 'kar-001',
    state,
    requested_by: { id: 1, name: 'Rina Wulandari' },
    created_at: T0,
    decided_at: null,
    finished_at: null,
    failure_code: null,
    failure_message: null,
    participants,
  }
}

describe('rowStatus', () => {
  it.each([
    [
      { prepare_state: 'refused' as const, decision_state: 'aborted' as const },
      'aborted',
      'ditolak',
    ],
    [
      { prepare_state: 'error' as const, decision_state: 'aborted' as const },
      'aborted',
      'tidak_merespons',
    ],
    [{ decision_state: 'failed' as const }, 'needs_attention', 'tidak_merespons'],
    [{ decision_state: 'committed' as const }, 'committed', 'tersimpan'],
    [{ decision_state: 'aborted' as const }, 'aborted', 'dibatalkan'],
    [
      { prepare_state: 'pending' as const, decision_state: 'pending' as const },
      'preparing',
      'menunggu',
    ],
    [{ decision_state: 'pending' as const }, 'committing', 'menyelesaikan'],
    [{ decision_state: 'pending' as const }, 'preparing', 'siap'],
  ])('%o in %s → %s', (patch, state, expected) => {
    expect(rowStatus(p('hr', patch), state as Transaction['state'])).toBe(expected)
  })
})

describe('order and timing', () => {
  it('always HR, Gudang, Produksi', () => {
    const order = byConsoleOrder([p('produksi'), p('hr'), p('gudang')]).map((x) => x.console.slug)
    expect(order).toEqual(['hr', 'gudang', 'produksi'])
  })

  it('response time runs from the transaction start to the last answer', () => {
    const t = tx('committed', [])
    expect(responseMs(p('hr'), t)).toBe(900)
    expect(responseMs(p('hr', { finished_at: null }), t)).toBe(300)
    expect(responseMs(p('gudang', { prepare_state: 'error', prepared_at: null }), t)).toBeNull()
  })
})

describe('trailSummary (Admin)', () => {
  it('committed: "Mengenai 3 dari 3 console"', () => {
    const s = trailSummary(tx('committed', [p('hr'), p('gudang'), p('produksi')]))
    expect(s).toEqual({ tone: 'ok', text: 'Mengenai 3 dari 3 console' })
  })

  it('refused: names the console and the code', () => {
    const s = trailSummary(
      tx('aborted', [
        p('hr', { decision_state: 'aborted' }),
        p('gudang', {
          prepare_state: 'refused',
          decision_state: 'aborted',
          refusal_code: 'INSUFFICIENT_STOCK',
        }),
        p('produksi', { decision_state: 'aborted' }),
      ]),
    )
    expect(s.text).toBe('Dibatalkan: Gudang menolak (INSUFFICIENT_STOCK)')
    expect(s.tone).toBe('error')
  })

  it('console down: names the silent console', () => {
    const s = trailSummary(
      tx('aborted', [
        p('hr', { decision_state: 'aborted' }),
        p('gudang', { prepare_state: 'error', decision_state: 'aborted' }),
        p('produksi', { decision_state: 'aborted' }),
      ]),
    )
    expect(s.text).toBe('Dibatalkan: Gudang tidak merespons')
  })

  it('202 in flight: counts finished consoles', () => {
    const s = trailSummary(
      tx('committing', [p('hr'), p('gudang'), p('produksi', { decision_state: 'pending' })]),
    )
    expect(s).toEqual({ tone: 'accent', text: 'Menyelesaikan: 2 dari 3 console selesai' })
  })
})

describe('userTrailMessage (User)', () => {
  it.each([
    ['committed', 'Tersimpan di semua sistem.'],
    ['aborted', 'Belum berhasil disimpan. Tidak ada data yang berubah.'],
    ['failed', 'Belum berhasil disimpan. Tidak ada data yang berubah.'],
    ['committing', 'Sedang diselesaikan…'],
    ['preparing', 'Sedang diselesaikan…'],
  ] as const)('%s → %s', (state, text) => {
    expect(userTrailMessage(state).text).toBe(text)
  })

  it('never contains console names or technical words', () => {
    for (const s of ['committed', 'aborted', 'failed', 'committing', 'needs_attention'] as const)
      expect(userTrailMessage(s).text).not.toMatch(/HR|Gudang|Produksi|console|tx_|commit/i)
  })
})
