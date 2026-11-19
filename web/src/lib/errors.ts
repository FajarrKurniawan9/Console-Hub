import { ApiError, type ClientErrorCode } from './api/client'

interface ErrorCopy {
  title: string
  /** What the user can do next. */
  next: string
}

// Technical copy for Admin IT. Codes and source names are fine here.
const ADMIN: Record<ClientErrorCode, ErrorCopy> = {
  SOURCE_TIMEOUT: {
    title: 'API sumber tidak merespons dalam batas waktu',
    next: 'Tidak ada data yang berubah. Cek halaman Sumber data, lalu coba lagi.',
  },
  SOURCE_UNREACHABLE: {
    title: 'API sumber tidak dapat dihubungi',
    next: 'Tidak ada data yang berubah. API sumber mungkin mati; cek halaman Sumber data, lalu coba lagi.',
  },
  VERSION_CONFLICT: {
    title: 'Data baru saja diubah',
    next: 'Muat ulang untuk mendapat versi terbaru, lalu coba lagi.',
  },
  REFERENCE_NOT_FOUND: {
    title: 'Data rujukan tidak ditemukan',
    next: 'Pilih data rujukan yang masih aktif, lalu kirim lagi.',
  },
  REFERENCED: {
    title: 'Masih dipakai data lain',
    next: 'Lepaskan dulu rujukan dari data di bawah, lalu coba lagi.',
  },
  CONFLICT: {
    title: 'Permintaan bertentangan',
    next: 'Data sudah berubah sejak terakhir dimuat. Muat ulang, lalu coba lagi.',
  },
  VALIDATION_ERROR: {
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
  SERVER_ERROR: {
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

// Plain copy for User: no source names, codes, or system words.
const SERVICE_DOWN: ErrorCopy = {
  title: 'Layanan sedang bermasalah',
  next: 'Perubahan data sementara tidak dapat disimpan. Coba lagi beberapa menit lagi.',
}
const USER: Partial<Record<ClientErrorCode, ErrorCopy>> = {
  SOURCE_TIMEOUT: SERVICE_DOWN,
  SOURCE_UNREACHABLE: SERVICE_DOWN,
  SERVER_ERROR: SERVICE_DOWN,
  VERSION_CONFLICT: {
    title: 'Data baru saja diubah',
    next: 'Data ini baru saja diubah orang lain. Muat ulang lalu coba lagi.',
  },
  REFERENCED: {
    title: 'Belum bisa dinonaktifkan',
    next: 'Data ini masih dipakai oleh data lain, jadi belum bisa dinonaktifkan.',
  },
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

export const SOURCE_CODES: ClientErrorCode[] = ['SOURCE_TIMEOUT', 'SOURCE_UNREACHABLE']

const REFERENCE_FIELD: Record<string, string> = {
  responsible_id: 'Personel yang dipilih tidak ditemukan atau sudah nonaktif.',
  courier_id: 'Personel yang dipilih tidak ditemukan atau sudah nonaktif.',
  production_id: 'Produksi yang dipilih tidak ditemukan atau sudah nonaktif.',
}

/** Message under a form field: the server's 422 text, or the plain sentence for a bad reference. */
export function fieldMessage(e: ApiError, name: string): string | undefined {
  if (e.code === 'VALIDATION_ERROR') return e.fields[name]?.[0]
  if (e.code === 'REFERENCE_NOT_FOUND' && name in e.fields)
    return e.fields[name]?.[0] ?? REFERENCE_FIELD[name]
  return undefined
}
