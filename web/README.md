# Console Hub — web

Frontend portal yang mengendalikan tiga web console (HR, Gudang, Produksi). Setiap perubahan
data dari portal ditulis ke ketiganya sebagai satu transaksi: berhasil di semuanya atau
dibatalkan di semuanya. Protokolnya dijalankan backend; frontend mengirim permintaan dan
menampilkan hasilnya.

Dua peran dalam satu aplikasi:

- **Admin IT**: tampilan lengkap dan teknis (ringkasan, console, log gabungan, transaksi,
  konsistensi data, pengguna & izin, audit, data kerja).
- **User**: tampilan kerja sederhana (Beranda, Pesanan, Barang, Karyawan, Divisi). Menu dan
  tombol mengikuti izin RBAC.

Frontend hanya memanggil API portal (`/api/v1`). Sampai backend Laravel siap, semua respons
datang dari mock MSW di `mocks/` yang mengikuti kontrak (brief v3 §5).

## Menjalankan

Butuh Node 20.19+ atau 22.12+ (Vite 8).

```bash
npm install
cp .env.example .env     # VITE_API_URL=/api/v1, VITE_USE_MOCKS=true
npm run dev              # http://localhost:5173
```

## Skrip

| Perintah            | Fungsi                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run dev`       | Server dev (dengan mock bila `VITE_USE_MOCKS=true`)                      |
| `npm run build`     | Typecheck + build produksi ke `dist/`                                    |
| `npm run typecheck` | `tsc -b` (strict)                                                        |
| `npm run lint`      | ESLint                                                                   |
| `npm test`          | Vitest + Testing Library + axe, terhadap server MSW Node, tanpa jaringan |
| `npm run format`    | Prettier                                                                 |

## Mock (dihapus saat integrasi)

Akun mock, data dummy saja:

| Email               | Sandi       | Peran                              |
| ------------------- | ----------- | ---------------------------------- |
| `admin@example.com` | `demo12345` | Admin IT                           |
| `user@example.com`  | `demo12345` | User                               |
| `siti@example.com`  | `demo12345` | User tanpa izin `pesanan.create`   |
| `agus@example.com`  | `demo12345` | User dinonaktifkan (login ditolak) |

Pilih skenario dengan `?scenario=<nama>` di URL (diingat untuk tab itu) atau lewat panel
**skenario mock** di kiri bawah:

| Skenario           | Yang terjadi                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `ok`               | Normal (bawaan). Gudang berstatus Lambat (2,4 dtk).                                             |
| `slow`             | Latensi 1–4 dtk; penulisan menjawab 202 lalu selesai.                                           |
| `gudang-down`      | Gudang mati: log Gudang berhenti, daftar Barang gagal, semua tulis ditolak 502.                 |
| `all-down`         | Ketiga console mati.                                                                            |
| `commit-stuck`     | Tulis menjawab 202; Produksi gagal commit 3 kali → `needs_attention` (selesaikan di Transaksi). |
| `drift`            | Pemeriksaan konsistensi Karyawan/Divisi menemukan baris hilang dan versi/checksum berbeda.      |
| `empty`            | Tanpa data kerja, log, transaksi, pemeriksaan, atau audit.                                      |
| `unauthenticated`  | Semua panggilan setelah login menjawab 401 → kembali ke login dengan catatan sesi berakhir.     |
| `forbidden`        | Log, Audit, daftar Barang, dan buat pesanan menjawab 403 walau peran mengizinkan.               |
| `validation-error` | Form tulis menjawab 422 dengan `fields`.                                                        |
| `rate-limited`     | ±30% permintaan menjawab 429.                                                                   |

Yang layak dicoba:

- **Penolakan per peran:** buat pesanan _Roti tawar kupas 400 g_ jumlah 500 (stok 120). User
  hanya melihat kalimatnya; Admin IT juga melihat alasan per console. Dengan PIC _Hendra
  Gunawan_ (sudah memegang 5 pesanan) muncul penolakan kedua dari HR.
- **Transaksi tersangkut:** Ringkasan → baris "Perlu tindakan" → "Coba commit ulang".
- **RBAC mengubah menu:** Pengguna & izin → Peran dan izin → User → hapus "Divisi: Lihat" →
  Simpan, lalu masuk sebagai `user@example.com`.
- **Konsistensi:** Barang → klik baris _Gula pasir_ → "Berbeda di Produksi" → Konsistensi →
  Perbaiki.

## Struktur

```
src/
  app/            router, provider, AdminLayout, UserLayout, penjaga rute, bar offline/console
  components/ui/  pembungkus Radix tipis (gaya shadcn) memakai token desain
  components/     StatusDot (+ TxStateBadge, LevelBadge), ConfirmDialog, JsonView, EmptyState, ErrorState…
  features/auth/
  features/work/  Karyawan, Divisi, Barang, Pesanan, Beranda User, useWrite (perilaku menyimpan)
  features/admin/ overview, consoles, logs, transactions, consistency, rbac, audit
  lib/api/        client.ts (klien tunggal), schemas.ts (kontrak + zod), work.ts
  lib/            permissions.tsx (hasPermission, useCan, <Can>), errors.ts, format.ts, status.ts
  styles/         tokens.css (token terang/gelap, skala Admin/User)
mocks/            SELURUH kode mock: handlers/, data/, engine/, scenarios.ts, DevPanel, browser.ts, node.ts
scripts/          contrast.test.ts (kontras AA token, kedua tema)
docs/             design-notes.md, integration.md, ideas.md, references/
```

## Catatan desain dan integrasi

- `docs/design-notes.md`: apa yang diambil dari tiap gambar referensi, dan setiap keputusan
  yang menyimpang dari brief beserta alasannya.
- `docs/integration.md`: langkah integrasi dengan backend dan penghapusan seluruh mock
  (dikerjakan nanti).
