import { ApiError, type ClientErrorCode } from './api/client'

interface ErrorCopy {
  title: string
  /** What the user can do next. */
  next: string
}

// Technical copy for Admin IT. Codes and console names are fine here.
const ADMIN: Record<ClientErrorCode, ErrorCopy> = {
  CONSOLE_TIMEOUT: {
    title: 'Console tidak merespons dalam batas waktu',
    next: 'Tidak ada data yang berubah. Cek halaman Console, lalu coba lagi.',
  },
  CONSOLE_UNREACHABLE: {
    title: 'Console tidak dapat dihubungi',
    next: 'Tidak ada data yang berubah. Console mungkin mati; cek halaman Console, lalu coba lagi.',
  },
  CONSOLE_ERROR: {
    title: 'Console mengembalikan error',
    next: 'Tidak ada data yang berubah. Lihat pesan di bawah dan log console terkait.',
  },
  TRANSACTION_REFUSED: {
    title: 'Transaksi ditolak',
    next: 'Tidak ada data yang berubah. Lihat alasan penolakan per console.',
  },
  VERSION_CONFLICT: {
    title: 'Data baru saja diubah',
    next: 'Muat ulang untuk mendapat versi terbaru, lalu coba lagi.',
  },
  LOCKED: {
    title: 'Data sedang diproses transaksi lain',
    next: 'Tunggu beberapa detik, muat ulang, lalu coba lagi.',
  },
  CONFLICT: {
    title: 'Status tidak cocok',
    next: 'Data sudah berubah sejak terakhir dimuat. Muat ulang, lalu coba lagi.',
  },
  VALIDATION_FAILED: {
    title: 'Data tidak valid',
    next: 'Perbaiki field yang ditandai, lalu kirim lagi.',
  },
  UNAUTHENTICATED: { title: 'Sesi berakhir', next: 'Masuk kembali untuk melanjutkan.' },
  FORBIDDEN: {
    title: 'Tidak punya izin',
    next: 'Peran Anda tidak memiliki izin untuk tindakan ini. Atur di halaman RBAC bila perlu.',
  },
  NOT_FOUND: { title: 'Data tidak ditemukan', next: 'Mungkin sudah dihapus atau tautannya salah.' },
  RATE_LIMITED: {
    title: 'Terlalu banyak permintaan',
    next: 'Tunggu beberapa detik, lalu coba lagi.',
  },
  INTERNAL_ERROR: {
    title: 'Error di server portal',
    next: 'Coba lagi. Bila berulang, periksa log portal pada waktu kejadian.',
  },
  NETWORK: {
    title: 'Tidak dapat terhubung ke portal',
    next: 'Periksa koneksi internet Anda, lalu coba lagi.',
  },
  CONTRACT_MISMATCH: {
    title: 'Respons portal tidak sesuai kontrak',
    next: 'Ini bug di portal. Laporkan ke tim pengembang beserta waktu kejadian.',
  },
}

// Plain copy for User: no console names, codes, or system words.
const SERVICE_DOWN: ErrorCopy = {
  title: 'Layanan sedang bermasalah',
  next: 'Tidak ada data yang berubah. Coba lagi beberapa menit lagi.',
}
const USER: Partial<Record<ClientErrorCode, ErrorCopy>> = {
  CONSOLE_TIMEOUT: SERVICE_DOWN,
  CONSOLE_UNREACHABLE: SERVICE_DOWN,
  CONSOLE_ERROR: SERVICE_DOWN,
  INTERNAL_ERROR: SERVICE_DOWN,
  TRANSACTION_REFUSED: { title: 'Tidak dapat disimpan', next: 'Tidak ada data yang berubah.' },
  FORBIDDEN: {
    title: 'Anda tidak punya akses',
    next: 'Hubungi admin IT bila Anda memerlukan akses ini.',
  },
  CONTRACT_MISMATCH: {
    title: 'Halaman tidak dapat menampilkan data',
    next: 'Coba lagi. Bila berulang, hubungi admin IT.',
  },
}

/** Plain-language copy for an error. `technical` = Admin IT view (codes and details allowed). */
export function describeError(err: unknown, technical: boolean) {
  const e = err instanceof ApiError ? err : new ApiError('NETWORK', String(err), 0)
  const copy = (!technical && USER[e.code]) || ADMIN[e.code]
  return { ...copy, code: e.code, message: e.message, error: e }
}

export const CONSOLE_CODES: ClientErrorCode[] = [
  'CONSOLE_TIMEOUT',
  'CONSOLE_UNREACHABLE',
  'CONSOLE_ERROR',
]
