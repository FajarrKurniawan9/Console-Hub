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
datang dari mock MSW di `mocks/` yang mengikuti kontrak (brief v3 + update 2 §3).

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

Mock meniru **hub**: tiga sumber di memori (HR → Personel, Produksi → Produksi, Gudang → Barang),
data digabung lintas sumber, referensi diperiksa sebelum menulis. Akun mock, data dummy saja:

| Email               | Sandi       | Peran                              |
| ------------------- | ----------- | ---------------------------------- |
| `admin@example.com` | `demo12345` | Admin IT                           |
| `user@example.com`  | `demo12345` | User                               |
| `siti@example.com`  | `demo12345` | User (hanya lihat)                 |
| `agus@example.com`  | `demo12345` | User dinonaktifkan (login ditolak) |

Pilih skenario dengan `?scenario=<nama>` di URL (diingat untuk tab itu) atau lewat panel
**skenario mock** di kiri bawah:

| Skenario           | Yang terjadi                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `ok`               | Normal (bawaan).                                                                            |
| `slow`             | Latensi 1–4 dtk di semua permintaan.                                                        |
| `empty`            | Tanpa data kerja, log, atau audit.                                                          |
| `unauthenticated`  | Semua panggilan setelah login menjawab 401 → kembali ke login dengan catatan sesi berakhir. |
| `forbidden`        | Log, Audit, daftar Barang, dan tambah personel menjawab 403 walau peran mengizinkan.        |
| `validation-error` | Setiap tulis menjawab 422 dengan `details.fields`.                                          |
| `rate-limited`     | ±30% permintaan menjawab 429.                                                               |
| `hr-down`          | HR mati: penanggung jawab/pengantar `null`, `meta.unavailable=['hr']`, tulis Personel 502.  |
| `produksi-down`    | Produksi mati: asal produksi `null`, daftar dan tulis Produksi 502.                         |
| `gudang-down`      | Gudang mati: daftar Barang 502 (Gudang pemilik data); Produksi dan Personel tetap jalan.    |
| `all-down`         | Ketiga sumber mati.                                                                         |
| `slow-source`      | HR menjawab setelah 3 dtk; Lacak Barang menampilkan status memuat per bagian.               |
| `conflict`         | Setiap PATCH menjawab 409 `VERSION_CONFLICT`.                                               |
| `referenced`       | Setiap DELETE menjawab 409 `REFERENCED`.                                                    |

Yang layak dicoba:

- **Lacak barang:** Beranda → Lacak barang → ketik "kain" → _Kain katun_. Admin IT melihat
  tiga baris "Sumber data" dengan status dan waktu respons. Ulangi dengan `?scenario=hr-down`.
- **Referensi:** sebagai Admin, Produksi → Nonaktifkan _Area Logam B · Pengecoran_ → muncul
  "masih dipakai" beserta daftar barang yang memakainya.
- **RBAC mengubah menu:** Pengguna & izin → Peran dan izin → User → hapus "Personel: Lihat" →
  Simpan, lalu masuk sebagai `user@example.com`.

## Struktur

```
src/
  app/            router, provider, AdminLayout, UserLayout, penjaga rute, bar offline/console
  components/ui/  pembungkus Radix tipis (gaya shadcn) memakai token desain
  components/     StatusDot (+ LevelBadge), ConfirmDialog, JsonView, EmptyState, ErrorState…
  features/auth/
  features/work/  Barang, Produksi, Personel, Lacak Barang, Beranda User, useWrite (perilaku menyimpan)
  features/admin/ overview, consoles (Sumber data), logs, rbac, audit
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
