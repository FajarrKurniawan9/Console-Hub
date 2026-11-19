import type { Tone } from '../components/StatusDot'
import type { ItemKind, LogEntry, MovementType, ReservationStatus } from './api/types'
import type { StockLevel } from './stock'

export const KIND_LABEL: Record<ItemKind, string> = { BB: 'Bahan baku', BJ: 'Barang jadi' }

export const STOCK_LEVEL: Record<StockLevel, { tone: Tone; label: string }> = {
  ok: { tone: 'ok', label: 'Aman' },
  low: { tone: 'warn', label: 'Menipis' },
  out: { tone: 'error', label: 'Habis' },
}

export const ACTIVE: Record<'aktif' | 'nonaktif', { tone: Tone; label: string }> = {
  aktif: { tone: 'ok', label: 'Aktif' },
  nonaktif: { tone: 'neutral', label: 'Nonaktif' },
}

export const RESERVATION: Record<ReservationStatus, { tone: Tone; label: string }> = {
  aktif: { tone: 'accent', label: 'Aktif' },
  dilepas: { tone: 'neutral', label: 'Dilepas' },
  dipakai: { tone: 'ok', label: 'Dipakai' },
}

export const LEVEL: Record<LogEntry['level'], { tone: Tone; label: string }> = {
  debug: { tone: 'neutral', label: 'Debug' },
  info: { tone: 'accent', label: 'Info' },
  warn: { tone: 'warn', label: 'Peringatan' },
  error: { tone: 'error', label: 'Galat' },
}

export const MOVEMENT: Record<MovementType, string> = {
  initial: 'Saldo awal',
  adjust_add: 'Tambah stok',
  adjust_correct: 'Koreksi jumlah',
  reserve: 'Reservasi',
  release: 'Reservasi dilepas',
  consume: 'Keluar untuk pesanan',
}
