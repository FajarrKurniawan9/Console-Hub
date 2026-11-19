import { ApiError } from './api/client'

/** Kalimat biasa untuk staf gudang, tanpa istilah teknis. */
const PLAIN: Partial<Record<ApiError['code'], string>> = {
  NETWORK: 'Tidak dapat terhubung ke server gudang. Periksa jaringan lalu coba lagi.',
  CONTRACT_MISMATCH: 'Data dari server tidak sesuai format. Hubungi tim IT bila berulang.',
  SERVER_ERROR: 'Server gudang sedang bermasalah. Coba lagi sebentar lagi.',
  RATE_LIMITED: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
  UNAUTHENTICATED: 'Sesi Anda berakhir. Silakan masuk lagi.',
  FORBIDDEN: 'Akun Anda tidak boleh melakukan ini.',
  NOT_FOUND: 'Data yang dicari tidak ditemukan.',
  LOCKED: 'Barang ini sedang diproses oleh sistem lain. Coba lagi sebentar lagi.',
  VERSION_CONFLICT: 'Rak ini baru saja diubah orang lain. Muat ulang lalu coba lagi.',
  RACK_NOT_EMPTY: 'Rak masih berisi stok. Pindahkan atau kosongkan stok dulu.',
  DUPLICATE_CODE: 'Kode rak sudah dipakai. Gunakan kode lain.',
  ITEM_INACTIVE: 'Barang ini sudah tidak aktif, stoknya tidak bisa disesuaikan.',
  RACK_INACTIVE: 'Rak ini sudah tidak aktif. Pilih rak lain.',
  INSUFFICIENT_STOCK: 'Jumlah baru lebih kecil dari stok yang sudah direservasi pesanan.',
  VALIDATION_ERROR: 'Ada isian yang belum benar. Periksa kembali form.',
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return PLAIN[err.code] ?? err.message
  if (err instanceof Error && err.message) return err.message
  return 'Terjadi gangguan. Coba lagi sebentar lagi.'
}
