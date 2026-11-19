> **Update 2 (2026-11-19):** transaksi dua fase, 202, `Idempotency-Key`, konsistensi, dan
> "Jejak 3 console" sudah dihapus. Butir di bawah yang menyebutnya tidak berlaku lagi; periksa
> sebagai gantinya: Barang/Produksi/Personel (tambah, ubah, nonaktifkan, `VERSION_CONFLICT`,
> `REFERENCE_NOT_FOUND`, `REFERENCED`), Lacak Barang (tiga sumber, `warnings`, `sources` hanya
> untuk Admin), dan perilaku saat satu sumber mati (`meta.unavailable`). Langkah penghapusan mock
> tidak berubah.

# Integrasi dengan backend

Langkah 1-3 (fase G) **sudah dikerjakan** pada 2026-11-19 terhadap hub Laravel + `tools/console-stub`.
Langkah 4-5 (fase H, hapus mock) belum.

## 1. Kontrak (selesai)

Kontrak hub mengikuti `src/lib/api/schemas.ts` tanpa perubahan skema; selisih yang tersisa dicatat di
`api/docs/contract-diff.md`. Diperiksa otomatis terhadap hub yang berjalan:

```bash
HUB_URL=http://127.0.0.1:8000/api/v1 HUB_ADMIN_EMAIL=… HUB_ADMIN_PASSWORD=… \
  HUB_USER_EMAIL=… HUB_USER_PASSWORD=… npm run test:hub
```

`src/lib/api/contract.hub.test.ts` mem-parse setiap respons yang dibaca layar (kedua peran), bentuk
error `VERSION_CONFLICT` / `REFERENCE_NOT_FOUND` / `VALIDATION_ERROR` / `REFERENCED`, dan memastikan
User mendapat 403 di `/admin/*` serta Lacak Barang tanpa `sources`. Tanpa `HUB_URL` tes dilewati;
`npm test` tidak menjalankannya.

## 2. Arahkan ke backend (selesai)

`VITE_API_URL=/api/v1` tetap; `npm run dev` meneruskan `/api` ke hub lewat proxy Vite (satu origin,
tanpa CORS). Target proxy: `VITE_PROXY_TARGET` (bawaan `http://127.0.0.1:8000`).

```bash
# 1. stub (lihat tools/console-stub/README.md)   2. hub
cd api && php artisan db:seed --database=pgsql_direct && php artisan hub:seed-demo && php artisan serve
# 3. web, mock mati: buat web/.env.hub.local berisi VITE_USE_MOCKS=false, lalu
cd web && npx vite --mode hub
```

## 3. Uji per layar (selesai)

Dijalankan di browser (Playwright) dengan mock mati, Admin IT dan User. Semua lulus:

| Skenario                                          | Hasil                                                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal                                            | Ringkasan, Barang, Produksi, Personel, Sumber data, Log, RBAC, Audit tampil tanpa `CONTRACT_MISMATCH`; Lacak Barang lengkap dengan tiga status sumber |
| HR mati                                           | Barang tampil, penanggung jawab "Tidak tersedia" + banner; Lacak Barang dengan peringatan                                                             |
| Gudang mati                                       | Barang: kartu error 502, tombol tambah nonaktif; Produksi dan Personel normal                                                                         |
| Hak akses                                         | User tanpa menu admin, `/rbac` manual 403, tab Network tanpa `/admin/*`                                                                               |
| Sesi habis                                        | Token dihapus → diarahkan ke login                                                                                                                    |
| Referensi tidak ada, masih dipakai, konflik versi | Lewat `npm run test:hub` dan `api/tests/Stub`                                                                                                         |

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
      `useWrite` (sukses, konflik, `REFERENCED`, sumber mati, 422), penjaga rute 403,
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
