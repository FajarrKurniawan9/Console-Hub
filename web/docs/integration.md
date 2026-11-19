> **Update 2 (2026-11-19):** transaksi dua fase, 202, `Idempotency-Key`, konsistensi, dan
> "Jejak 3 console" sudah dihapus. Butir di bawah yang menyebutnya tidak berlaku lagi; periksa
> sebagai gantinya: Barang/Produksi/Personel (tambah, ubah, nonaktifkan, `VERSION_CONFLICT`,
> `REFERENCE_NOT_FOUND`, `REFERENCED`), Lacak Barang (tiga sumber, `warnings`, `sources` hanya
> untuk Admin), dan perilaku saat satu sumber mati (`meta.unavailable`). Langkah penghapusan mock
> tidak berubah.

# Integrasi dengan backend

Ditulis sekarang, **dikerjakan nanti** setelah backend Laravel siap (brief v3 §12). Jangan
jalankan langkah-langkah ini sebelum diminta. Di akhir integrasi **semua mock dihapus**.

## 1. Sepakati kontrak

Bandingkan kontrak di `src/lib/api/schemas.ts` (brief v3 §5) dengan kontrak backend yang
sebenarnya. Perbarui tipe dan skema zod di `src/lib/api/` bila ada perbedaan, lalu catat di
`docs/design-notes.md`. Hal yang masih asumsi dan perlu dikonfirmasi:

| Hal                      | Asumsi frontend                                                      | Catatan                                                     |
| ------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `?verify=all`            | `consistency: { in_sync, consoles: [{ console, version, status }] }` | Brief menyebut, tidak memberi tipe (design-notes #8)        |
| `AuthUser.role.code`     | `string` (bukan hanya `admin_it`/`user`)                             | design-notes #7                                             |
| `GET /admin/logs?q=`     | Juga mencocokkan `tx_id`                                             | design-notes #33                                            |
| Kapan console mati       | Memakai `last_checked_at`                                            | Tidak ada `down_since` di kontrak (#9)                      |
| `POST /admin/rbac/users` | Backend yang menentukan sandi awal                                   | Mock mengirim `initial_password`; UI tidak memakainya (#40) |
| Filter pengguna di Audit | `GET /admin/rbac/users`                                              | Butuh `admin.rbac.manage` (#41)                             |

Respons yang tidak cocok dengan skema tampil sebagai error `CONTRACT_MISMATCH` (tidak pernah
diam-diam salah), dan di mode dev rinciannya dicetak di konsol browser.

## 2. Arahkan ke backend

```bash
# .env
VITE_API_URL=https://<alamat-backend>/api/v1
VITE_USE_MOCKS=false
```

Di sisi backend: CORS mengizinkan origin frontend dengan header `Authorization`,
`Idempotency-Key`, dan `Content-Type` (atau taruh API di origin yang sama lewat reverse proxy).
Jalankan `npm run dev`, lalu uji login dengan akun Admin IT dan User yang sungguhan.

## 3. Uji per layar terhadap backend sungguhan

Urutan: Login → Beranda User → Karyawan, Divisi, Barang, Pesanan (kedua peran) → Ringkasan →
Console → Log → Transaksi → Konsistensi → RBAC → Audit. Perbaiki ketidakcocokan di
`src/lib/api/` (skema dan fungsi endpoint), **bukan** di komponen.

## 4. Hapus seluruh mock

- [ ] Hapus folder `mocks/` dan `public/mockServiceWorker.js`.
- [ ] Hapus blok `// MOCK-ONLY` beserta impor dinamisnya di `src/main.tsx` (sisakan hanya
      `createRoot(...).render(...)`).
- [ ] `package.json`: hapus dependensi `msw` dan bagian `"msw": { "workerDirectory": ... }`.
- [ ] `vite.config.ts`: hapus grup chunk `mocks`, `./mocks/vitest.setup.ts` dari `setupFiles`, dan
      pola `mocks/**` dari `test.include`; hapus `VITE_USE_MOCKS` dari `test.env`.
- [ ] `tsconfig.app.json`: hapus `"mocks"` dari `include`.
- [ ] `eslint.config.js`: hapus `'mocks/**'` dari daftar file pengecualian.
- [ ] Hapus `VITE_USE_MOCKS` dari `.env.example`, `.env`, `src/vite-env.d.ts` (bila ada), dan README.
- [ ] Hapus panel dev skenario (ada di `mocks/`, ikut terhapus), akun dummy, dan data dummy di
      mana pun (README bagian Mock).
- [ ] Uji berakhiran `.mock.test.ts(x)` bergantung pada MSW. Hapus, atau tulis ulang memakai fungsi
      API yang di-stub per uji (`vi.mock('../lib/api/work')` dsb.). Pertahankan setidaknya: perilaku
      `useWrite` (sukses, 202, ditolak per peran, konflik, console mati, 422), penjaga rute 403,
      dua kerangka per peran, dan matriks RBAC.
      Uji tanpa MSW yang tetap jalan: `src/components/components.test.tsx`,
      `scripts/contrast.test.ts`.
- [ ] `src/test/utils.tsx`: `renderApp(path, as)` memakai token `mock-<id>-test`; ganti dengan
      cara login yang sesuai stub baru.
- [ ] Perbarui `README.md` dan `docs/`.

## 5. Verifikasi bersih

Semua perintah ini harus **tanpa temuan**:

```bash
grep -rniE "msw|mockServiceWorker|VITE_USE_MOCKS|MOCK-ONLY|demo12345" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist
grep -rn "from '.*mocks" src
```

Kemudian `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` harus lulus, dan
`package.json` tidak lagi memuat `msw`.

Catatan: file ini sendiri berisi kata-kata di atas. Hapus atau pindahkan `docs/integration.md`
ke riwayat setelah integrasi selesai, supaya grep di atas bersih.

## 6. Uji ujung ke ujung terhadap backend

- [ ] "Jejak 3 console": polling pada status 202 berjalan sampai final, dan tiga partisipan selalu tampil berurutan HR, Gudang, Produksi.

- [ ] Sukses: buat pesanan → daftar berubah, stok berkurang.
- [ ] Penolakan: pesanan melebihi stok → User melihat kalimat bisnis saja; Admin IT melihat
      alasan per console.
- [ ] Konflik versi: ubah data yang sama di dua tab → tab kedua mendapat dialog "Muat ulang".
- [ ] Console dimatikan: matikan Gudang → daftar Barang gagal dengan pesan yang benar, tulis
      ditolak, banner di kerangka Admin.
- [ ] Transaksi 202: "Sedang diselesaikan…" lalu hasil akhir tanpa muat ulang.
- [ ] `needs_attention`: diselesaikan dari detail Transaksi.
- [ ] Dua peran: User tidak pernah melihat log, nama console, ID transaksi, kode error, atau
      JSON, dan URL admin langsung memberi 403.
- [ ] RBAC: cabut izin dari peran User → menu User berubah pada pemuatan `me` berikutnya.
