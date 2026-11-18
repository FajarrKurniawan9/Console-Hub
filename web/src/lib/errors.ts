import { ApiError, type ClientErrorCode } from './api'

interface ErrorCopy {
  title: string
  /** What the user can do next. */
  next: string
}

// `who` is the console name when the error names one, otherwise "Portal".
const COPY: Record<ClientErrorCode, (who: string) => ErrorCopy> = {
  CONSOLE_TIMEOUT: (who) => ({
    title: `${who} tidak merespons dalam batas waktu`,
    next: 'Console sedang lambat. Coba lagi beberapa saat lagi atau cek halaman console.',
  }),
  CONSOLE_UNREACHABLE: (who) => ({
    title: `${who} tidak dapat dihubungi`,
    next: 'Console mungkin mati atau jaringannya putus. Cek halaman console, lalu coba lagi.',
  }),
  CONSOLE_ERROR: (who) => ({
    title: `${who} mengembalikan error`,
    next: 'Permintaan sampai ke console, tetapi console menolaknya. Lihat pesan di bawah.',
  }),
  VALIDATION_FAILED: () => ({
    title: 'Data tidak valid',
    next: 'Perbaiki field yang ditandai, lalu kirim lagi.',
  }),
  UNAUTHENTICATED: () => ({
    title: 'Sesi berakhir',
    next: 'Masuk kembali untuk melanjutkan.',
  }),
  FORBIDDEN: () => ({
    title: 'Tidak punya akses',
    next: 'Halaman ini hanya untuk admin. Minta akses ke admin portal bila diperlukan.',
  }),
  NOT_FOUND: () => ({
    title: 'Data tidak ditemukan',
    next: 'Mungkin sudah dihapus atau tautannya salah.',
  }),
  CONFLICT: () => ({
    title: 'Status tidak cocok',
    next: 'Data sudah berubah sejak terakhir dimuat. Muat ulang, lalu coba lagi.',
  }),
  RATE_LIMITED: () => ({
    title: 'Terlalu banyak permintaan',
    next: 'Tunggu beberapa detik, lalu coba lagi.',
  }),
  NETWORK: () => ({
    title: 'Tidak dapat terhubung ke portal',
    next: 'Periksa koneksi internet Anda, lalu coba lagi.',
  }),
  CONTRACT_MISMATCH: () => ({
    title: 'Respons portal tidak sesuai kontrak',
    next: 'Ini bug di portal. Laporkan ke tim pengembang beserta waktu kejadian.',
  }),
}

export function describeError(err: unknown, consoleName?: (slug: string) => string | undefined) {
  const e = err instanceof ApiError ? err : new ApiError('NETWORK', String(err), 0)
  const who = (e.console && consoleName?.(e.console)) || e.console || 'Portal'
  return { ...COPY[e.code](who), code: e.code, message: e.message, error: e }
}

export const CONSOLE_CODES: ClientErrorCode[] = [
  'CONSOLE_TIMEOUT',
  'CONSOLE_UNREACHABLE',
  'CONSOLE_ERROR',
]
