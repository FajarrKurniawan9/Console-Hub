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
# 3. web
cd web && npm run dev
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

## 4. Hapus seluruh mock (selesai)

`mocks/`, `public/mockServiceWorker.js`, blok `MOCK-ONLY` di `src/main.tsx`, dependensi `msw`, dan
`VITE_USE_MOCKS` sudah dihapus. Uji `*.mock.test.tsx` ditulis ulang memakai hub palsu per uji
(`src/test/api.ts`, adapter axios); perilaku yang dipertahankan: `useWrite` (sukses, 422,
`REFERENCE_NOT_FOUND`, `VERSION_CONFLICT`, `REFERENCED`, sumber mati), penjaga rute 403, dua
kerangka per peran, RBAC, Lacak Barang, dan axe.

## 5. Verifikasi bersih

```bash
grep -rniE "msw|mockServiceWorker|VITE_USE_MOCKS|MOCK-ONLY|demo12345" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=package-lock.json \
  --exclude=integration.md
grep -rn "from '.*mocks" src
```

Keduanya tanpa temuan. `package-lock.json` dikecualikan karena `msw` hanya tercatat di sana sebagai
_optional peer dependency_ milik vitest, bukan dependensi proyek.
