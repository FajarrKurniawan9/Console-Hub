import type { ConsistencyCheck, ConsistencyFinding } from '../../../lib/api/schemas'
import type { Tone } from '../../../lib/status'

export const ENTITY: Record<ConsistencyCheck['entity_type'], string> = {
  divisi: 'Divisi',
  karyawan: 'Karyawan',
  barang: 'Barang',
}

export const CHECK_STATUS: Record<ConsistencyCheck['status'], { label: string; tone: Tone }> = {
  running: { label: 'Berjalan', tone: 'accent' },
  clean: { label: 'Bersih', tone: 'ok' },
  drift: { label: 'Ada temuan', tone: 'error' },
  failed: { label: 'Gagal', tone: 'error' },
}

export const KIND: Record<ConsistencyFinding['kind'], string> = {
  missing: 'Hilang',
  version_mismatch: 'Versi berbeda',
  checksum_mismatch: 'Checksum berbeda',
}
