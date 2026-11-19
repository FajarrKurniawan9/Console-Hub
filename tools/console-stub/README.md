# console-stub

Pengganti sementara tiga API sumber (HR, Gudang, Produksi) untuk pengembangan hub. **Hanya dipakai
sampai tiga API nyata siap.** Setelah itu cukup ganti `CONSOLE_*_URL` dan `CONSOLE_*_KEY` di
`api/.env` lalu jalankan `php artisan db:seed --database=pgsql_direct`; hub tidak perlu diubah.

Mengikuti `kontrak-3-api-console-hub-v1.md` bagian 1 sampai 4: `GET /health`, `GET /api/v1/logs`,
CRUD `/api/v1/{people|items|productions}` dengan `?q=`, filter, `?ids=`, `?status=`, `?limit=`,
kursor, `version`, `expected_version` (`VERSION_CONFLICT`), `DUPLICATE` untuk produksi, soft delete,
dan kunci layanan `X-Service-Key` (401). Tanpa dependensi: cukup Node 20+.

## Menjalankan

```bash
STUB_HR_KEY=... STUB_GUDANG_KEY=... STUB_PRODUKSI_KEY=... ./start-all.sh
```

| Instance | Port | Sumber |
|---|---|---|
| `hr` | 9101 | `people` |
| `gudang` | 9102 | `items` |
| `produksi` | 9103 | `productions` |

Isi `api/.env` dengan kunci yang sama (`CONSOLE_HR_KEY`, `CONSOLE_GUDANG_KEY`, `CONSOLE_PRODUKSI_KEY`),
lalu dari `api/`:

```bash
php artisan db:seed --database=pgsql_direct   # mendaftarkan tiga sumber
php artisan hub:seed-demo                     # mengisi stub lewat alur tulis hub
```

Data disimpan di `.stub-data/<sumber>.json` (tidak masuk Git). Stub mulai kosong.

## Endpoint dev (hanya bila `STUB_DEV=true`)

```bash
curl -X POST localhost:9101/dev/fault -H 'Content-Type: application/json' -d '{"mode":"down"}'
# mode: none | down (koneksi diputus) | slow (tunda `ms`, default 3000) | error500
curl -X POST localhost:9101/dev/reset   # kosongkan data dan log
```

## Satu tambahan di luar kontrak (USULAN)

`POST` menerima `id` (UUID) opsional. Hanya `hub:seed-demo` yang mengirimnya, agar ID seed deterministik
(kontrak bagian 6) sama di ketiga API. Endpoint publik hub tidak meneruskan `id`.
