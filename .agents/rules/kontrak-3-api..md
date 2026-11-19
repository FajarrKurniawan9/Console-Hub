# Kontrak Tiga API Console Hub (Gudang, Produksi, HR) v1

Dokumen ini adalah **pegangan bersama** untuk siapa pun yang membangun salah satu dari tiga API, serta untuk backend hub yang memakainya. Bila ada yang tidak cocok saat membangun, ubah dokumen ini dulu, baru kodenya.

Konsep: satu frontend (portal) dan satu backend hub memakai **tiga API berbeda**. Setiap API memegang datanya sendiri, di database Neon-nya sendiri. Hub membaca dan menggabungkan data; tidak ada transaksi lintas API.

| API | Peran | Data yang dipegang | Menunjuk ke |
|---|---|---|---|
| Gudang | Inventaris | Barang: nama, jenis, asal masuk produksi, penanggung jawab | Produksi (`production_id`), HR (`responsible_id`) |
| Produksi | Pemasok dan pengantar | Produksi: area, jenis produksi, pengantar | HR (`courier_id`) |
| HR | Orang yang menjalankan alur distribusi | Personel: nama, role | tidak ada |

> Bagian bertanda **(USULAN)** adalah tambahan saya di atas catatan Kak Jo. Hapus atau ubah bila Kak Jo tidak setuju.

---

## 1. Aturan umum (berlaku untuk ketiga API)

**Teknis**
- Laravel (API saja, tanpa UI), PostgreSQL di Neon (satu database per API, nama bebas, bukan `console-test` yang milik hub), semua SQL standar agar bisa pindah ke Azure PostgreSQL.
- Prefix `/api/v1`. Format JSON. Waktu ISO 8601 UTC.
- Setiap API berjalan sebagai layanan sendiri (port dev: Gudang 9102, Produksi 9103, HR 9101).

**Autentikasi (hanya hub yang memanggil)**
- Header wajib pada semua endpoint kecuali `/health`: `X-Service-Key` (satu kunci per API, di `.env`), `X-Request-Id`; opsional `X-Acting-User` (ID pengguna hub, untuk log).
- Kunci salah atau hilang: `401 UNAUTHENTICATED`. Kunci tidak pernah muncul di respons atau log.

**Envelope**
- Sukses satu data: `{ "data": {...} }`. Daftar: `{ "data": [...], "meta": { "next_cursor": "..." | null } }`.
- Error: `{ "error": { "code": "...", "message": "...", "details": {...} } }`.
- Kode error umum: `UNAUTHENTICATED` 401, `NOT_FOUND` 404, `VALIDATION_ERROR` 422 (`details.fields`), `VERSION_CONFLICT` 409, `DUPLICATE` 409, `RATE_LIMITED` 429, `SERVER_ERROR` 500.

**Kolom umum pada setiap data**
- `id` (UUID, dibuat oleh API pemilik), `status` (`aktif` | `nonaktif`), `version` (integer, mulai 1, naik satu pada setiap perubahan), `created_at`, `updated_at`.

**Aturan tulis**
- `POST` membuat data baru dengan `version = 1`, `status = aktif`.
- `PATCH` wajib `expected_version` di body; bila tidak sama dengan `version` sekarang: `409 VERSION_CONFLICT`. Hasil menaikkan `version`.
- `DELETE` adalah **nonaktifkan** (soft delete): wajib `?expected_version=N` (query string, bukan body). Data nonaktif tetap bisa dibaca dengan `?status=nonaktif` atau `?status=all`; default daftar hanya `aktif`.
- Hapus permanen tidak ada.

**Aturan daftar**
- Parameter umum: `?q=` (cari nama), `?status=aktif|nonaktif|all`, `?limit=` (default 25, maksimal 100), `?cursor=`.
- **`?ids=a,b,c`** (maksimal 100 ID): mengembalikan hanya data dengan ID itu, termasuk yang nonaktif. Dipakai hub untuk menggabungkan data tanpa panggilan berulang.
- Urutan default: `created_at` menurun.

**Endpoint umum (ketiga API)**
| Metode | Path | Fungsi |
|---|---|---|
| GET | `/health` | Tanpa kunci. `{ "status": "ok" }` |
| GET | `/api/v1/logs?since=&cursor=&limit=` | Log seragam `{ id, occurred_at, level, message, actor }`; `level`: `debug` `info` `warn` `error`. Dicatat untuk setiap tulis dan setiap error |

**Referensi ke API lain**
- Kolom penunjuk (`production_id`, `responsible_id`, `courier_id`) hanya menyimpan UUID. **API tidak memanggil API lain dan tidak memeriksa keberadaan referensinya.** Pemeriksaan dilakukan hub sebelum menulis (bagian 5).

---

## 2. API HR (`/api/v1/people`)

Data personel.

```jsonc
// Person
{
  "id": "uuid",
  "name": "string, 2-120",
  "role": "string, 2-60",          // peran dalam alur distribusi; teks bebas (USULAN: daftar tetap bila Kak Jo mau)
  "status": "aktif",
  "version": 1,
  "created_at": "...", "updated_at": "..."
}
```

| Metode | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/people` | Daftar; `?q=` (nama), `?role=`, `?status=`, `?ids=` |
| POST | `/api/v1/people` | Body `{name, role}`. 201 + Person |
| GET | `/api/v1/people/{id}` | Detail; 404 bila tidak ada |
| PATCH | `/api/v1/people/{id}` | Body `{name?, role?, expected_version}`. 200 + Person |
| DELETE | `/api/v1/people/{id}?expected_version=N` | Nonaktifkan. 200 + Person |

Aturan: `name` + `role` tidak harus unik (nama kembar mungkin ada), karena itu semua penunjukan memakai `id`.

---

## 3. API Produksi (`/api/v1/productions`)

Data produksi sebagai pemasok, beserta pengantarnya.

```jsonc
// Production
{
  "id": "uuid",
  "area": "string, 2-80",             // area produksi, mis. "Area Tekstil A"
  "production_type": "string, 2-80",  // jenis produksi, mis. "Tenun"
  "courier_id": "uuid | null",        // pengantar -> HR (Person.id)
  "status": "aktif",
  "version": 1,
  "created_at": "...", "updated_at": "..."
}
```

| Metode | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/productions` | Daftar; `?q=` (cari area/jenis), `?production_type=`, `?courier_id=`, `?status=`, `?ids=` |
| POST | `/api/v1/productions` | Body `{area, production_type, courier_id?}`. 201 + Production |
| GET | `/api/v1/productions/{id}` | Detail |
| PATCH | `/api/v1/productions/{id}` | Body `{area?, production_type?, courier_id?, expected_version}` (`courier_id: null` melepas pengantar). 200 |
| DELETE | `/api/v1/productions/{id}?expected_version=N` | Nonaktifkan |

Aturan: kombinasi `area` + `production_type` yang sama dan masih `aktif` ditolak `409 DUPLICATE` (satu area tidak punya dua baris produksi dengan jenis yang sama).

---

## 4. API Gudang (`/api/v1/items`)

Inventaris barang dan bahan.

```jsonc
// Item
{
  "id": "uuid",
  "name": "string, 2-120",             // mis. "Kain katun"
  "kind": "string, 2-60",              // jenis bahan/barang: kain, besi, buku, makanan kaleng, ...
  "production_id": "uuid | null",      // asal masuk produksi -> Produksi (Production.id)
  "responsible_id": "uuid | null",     // penanggung jawab -> HR (Person.id)
  "quantity": 0,                       // (USULAN) jumlah stok, integer >= 0
  "unit": "pcs",                       // (USULAN) satuan: pcs, kg, m, kaleng, ...
  "status": "aktif",
  "version": 1,
  "created_at": "...", "updated_at": "..."
}
```

| Metode | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/items` | Daftar; `?q=` (nama), `?kind=`, `?production_id=`, `?responsible_id=`, `?status=`, `?ids=` |
| POST | `/api/v1/items` | Body `{name, kind, production_id?, responsible_id?, quantity?, unit?}`. 201 + Item |
| GET | `/api/v1/items/{id}` | Detail |
| PATCH | `/api/v1/items/{id}` | Body `{name?, kind?, production_id?, responsible_id?, quantity?, unit?, expected_version}`. 200 |
| DELETE | `/api/v1/items/{id}?expected_version=N` | Nonaktifkan |

Aturan: `kind` disimpan apa adanya (teks bebas); `GET /api/v1/items/kinds` (USULAN) mengembalikan daftar `kind` yang sedang dipakai agar hub bisa membuat filter.

---

## 5. Tugas hub (bukan tugas API)

Hub yang menjaga hubungan antar-API karena API tidak saling memanggil.

- **Sebelum menulis** `production_id` / `responsible_id` / `courier_id`: hub memastikan ID itu ada dan `aktif` di API tujuan (`GET /{resource}/{id}`). Tidak ada: hub menolak `422 REFERENCE_NOT_FOUND` tanpa memanggil API pemilik.
- **Sebelum menonaktifkan**: hub memeriksa apakah data masih dipakai.
  - Personel: ada Barang aktif dengan `responsible_id` itu, atau Produksi aktif dengan `courier_id` itu → `409 REFERENCED`.
  - Produksi: ada Barang aktif dengan `production_id` itu → `409 REFERENCED`.
  - Barang: tidak ada yang menunjuknya; langsung boleh.
- **Menggabungkan** (daftar, detail, Lacak Barang): memakai `?ids=` agar satu daftar 25 barang hanya memanggil API lain satu kali, bukan 25 kali.
- Bila satu API tidak terjangkau saat membaca, hub tetap menampilkan data dari API yang hidup dan menandai bagian yang tidak tersedia.
- Tidak ada jaminan atomik lintas API. Antar-API dijaga lewat pemeriksaan di atas; selisih yang lolos (mis. data diubah langsung di API) dianggap bisa terjadi dan terlihat sebagai referensi yang tidak ditemukan saat digabung.

---

## 6. Yang harus dibangun tiap API (daftar periksa)

- [ ] Proyek Laravel API saja, koneksi Neon sendiri (`.env`, tidak masuk Git), `sslmode=require`, host pooled untuk runtime dan host direct untuk migrasi.
- [ ] Migrasi tabel data utama + `app_logs` (`id`, `occurred_at`, `level`, `message`, `actor`, `request_id`, `context` jsonb).
- [ ] Middleware kunci layanan, `X-Request-Id` di setiap respons, rate limit.
- [ ] Endpoint bagian 2, 3, atau 4 sesuai API, lengkap dengan `?ids=`, filter, kursor, `version`, `expected_version`.
- [ ] `/health` dan `/api/v1/logs`.
- [ ] Seed demo (idempoten): HR 12 personel; Produksi 6 baris produksi (sebagian dengan pengantar dari seed HR); Gudang 15 barang (jenis beragam: kain, besi, buku, makanan kaleng, ...; ID penunjuk memakai UUID tetap dari seed HR dan Produksi). Gunakan UUID **deterministik** (uuid v5 dari kunci alami) agar seed ketiga API saling cocok tanpa saling memanggil.
- [ ] Tes (Pest): semua endpoint, `VERSION_CONFLICT`, `?ids=`, kunci salah, validasi; Pint bersih.
- [ ] `README.md`: cara menjalankan, daftar `.env`, contoh `curl`.

UUID seed deterministik (disepakati bersama):
- `uuid v5(namespace = "7a1f6c3e-5b8d-4f21-9a0c-3e2d1b4c5a60", name = "person:<nama-slug>")` untuk personel.
- `uuid v5(namespace, "production:<area-slug>:<jenis-slug>")` untuk produksi.
- `uuid v5(namespace, "item:<nama-slug>")` untuk barang.
- **(USULAN)** Slug: huruf kecil, setiap deretan karakter selain huruf/angka menjadi `-`, tanpa `-` di ujung (`Str::slug` Laravel). Contoh: `person:rina-wulandari`, `production:area-tekstil-a:tenun`.
- **(USULAN)** Agar seed lewat hub (`hub:seed-demo`) menghasilkan ID ini, `POST` setiap API menerima `id` (UUID) opsional; bila sudah dipakai: `409 DUPLICATE`. Endpoint publik hub tidak pernah meneruskan `id` dari pengguna.

---

## 7. Hal yang masih terbuka (jawaban Kak Jo)

1. Frontend memanggil API langsung atau lewat hub? Kontrak ini mengasumsikan **lewat hub** (kunci layanan tidak boleh ada di browser).
2. Apakah `role` personel teks bebas atau daftar tetap?
3. Apakah Gudang perlu stok (`quantity`, `unit`)? Ditandai USULAN.
4. Apakah User boleh menambah atau mengubah data, atau hanya melihat? Kontrak ini mendukung tulis; izin diatur RBAC di hub.