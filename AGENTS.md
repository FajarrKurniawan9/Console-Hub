# Panduan & Batasan Peran Agen: Fullstack Developer (Console Hub)

Dokumen ini adalah aturan tetap (*system guidelines*) bagi AI Agent (Claude Code, Antigravity, Cursor, Codex, dll.) yang bekerja di repositori **Console Hub**.

> **PENTING (STRICT BOUNDARY):**
> Pengguna memegang peran sebagai **Fullstack Developer (Laravel + React)**. AI Agent **WAJIB** fokus secara ketat pada tugas Fullstack dan **DILARANG KERAS** melenceng atau merebut tanggung jawab dari role lain (Cloud/Infrastruktur dan DB Schema), serta **DILARANG** mengerjakan fitur di luar ruang lingkup (*non-goals*).

> **UPDATE v3 (2026-11-19) — menggantikan bagian yang bertentangan di bawah:**
> Backend portal dibangun ulang mengikuti brief v3 (koordinator transaksi dua fase ke 3 console HR/Gudang/Produksi).
> - Database portal: hanya Neon `consolehub_test` (dijaga `App\Support\DatabaseGuard`). Tabel: `roles`, `permissions`, `role_permissions`, `users`, `code_counters`, `consoles`, `console_health_checks`, `log_sync_state`, `log_entries`, `audit_events`, `transactions`, `transaction_participants`, `consistency_checks`, `consistency_findings` (+ tabel bawaan Laravel).
> - RBAC berbasis peran & izin (`admin_it`, `user`, izin `sumber.aksi`) **diizinkan** — non-goal no. 3 tidak berlaku lagi.
> - Fitur proses/runs/resources (processes, process_steps, process_runs, run_steps, ExecuteRun, ProcessEngine, `/consoles/:id/resources`) **dihapus**.
> - Kontrak JSON mengikuti `web/src/lib/api/schemas.ts`; selisih dicatat di `api/docs/contract-diff.md`.

---

## 1. Pembagian Peran Tim & Batasan Kerja

Proyek ini dikerjakan oleh tim 3 orang dengan pembagian peran sesuai Dokumen Teknis (*Dokumen Teknis: Portal Pengatur Proses Multi-Console*):

| Peran | Pemilik Tanggung Jawab | Batasan bagi Agen Ini |
|---|---|---|
| **Fullstack (Laravel + React)** | **ROLE KITA (FOKUS DI SINI)** | Mengembangkan seluruh aplikasi di folder `api/` (Laravel) dan `web/` (React). Memastikan API dan UI terhubung dengan benar, lolos tes, dan siap dijalankan di lokal maupun staging. |
| **Cloud (NeonDB & Infra)** | **Orang Lain (JANGAN AMBIL ALIH)** | DILARANG mengurus infrastruktur cloud langsung: membuat project/branch Neon di cloud, hosting cloud/staging portal, CI/CD pipeline cloud, hosting mock-console di server eksternal, atau menulis `docs/ops.md`. Fullstack hanya menyediakan file `.env.example`, perintah build, serta perintah worker/scheduler. |
| **DB Schema** | **Orang Lain (JANGAN AMBIL ALIH)** | DILARANG mendesain ulang arsitektur DB dari nol, membuat ERD terpisah, atau dataset JSON mock consoles. Fullstack hanya mengimplementasikan migrasi dan seeder di Laravel sesuai daftar tabel di UPDATE v3. |

---

## 2. Non-Goals (Fitur yang DILARANG Dibuat)

Jangan pernah membuat atau mengusulkan hal-hal berikut karena berada di luar ruang lingkup (non-goals):
1. ❌ **Editor alur visual drag-and-drop ala n8n**: Antarmuka proses cukup berupa daftar urutan langkah (*step list*) sederhana.
2. ❌ **Percabangan & perulangan kompleks**: Mesin proses hanya menjalankan urutan langkah sekuensial (*sequential pipeline*), tanpa percabangan (*if/else*) atau perulangan (*looping*).
3. ~~❌ **Manajemen role & permission rumit**~~ (dicabut oleh UPDATE v3: RBAC peran + izin).
4. ❌ **Akses database console langsung**: Portal **HANYA** boleh berkomunikasi lewat HTTP API resmi masing-masing console. Tidak boleh ada koneksi database langsung ke console eksternal.
5. ❌ **Notifikasi Real-time (WebSocket / SSE)**: Cukup gunakan polling berkala di frontend (misalnya polling tiap 2 detik untuk eksekusi proses).

---

## 3. Tugas & Tanggung Jawab Role Fullstack

### A. Frontend (`web/`) — React + Vite + TypeScript
- **Stack**: React, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, React Router, MSW.
- **8 Halaman Utama**:
  1. **Login** (`/login`): Autentikasi token Sanctum, penanganan token kedaluwarsa.
  2. **Ringkasan / Overview** (`/`): Kartu status console, metrik log error 24 jam, eksekusi proses terbaru.
  3. **Console Hub** (`/consoles` & `/consoles/:id`): Daftar console, indikator status (`ok`, `slow`, `down`), latensi, uji koneksi instan.
  4. **Log Gabungan** (`/logs`): Tabel log seragam dengan filter waktu, level (`debug`, `info`, `warn`, `error`), console, pencarian teks, detail data mentah (*raw*).
  5. **Atur Data Resources** (`/consoles/:id/resources/:key`): Melihat dan mengedit data operasional console yang diizinkan (`writable_fields`), audit otomatis nilai lama dan baru.
  6. **Definisi Proses** (`/processes` & detail): Daftar alur proses, detail urutan langkah, modal/form eksekusi dengan validasi skema input.
  7. **Eksekusi / Runs** (`/runs` & `/runs/:id`): Monitoring proses berjalan via live polling (2 detik), visual strip langkah, status langkah (`pending`, `running`, `succeeded`, `failed`, `skipped`, `compensated`, `compensation_failed`), tombol retry langkah gagal, dan cancel run.
  8. **Audit Trail** (`/audit`): Khusus admin; pelacakan seluruh aktivitas tulis dan eksekusi.
- **State Handling**: Wajib menangani 5 kondisi visual: Loading (Skeleton), Empty State, Error State, Banner Console Down, dan Token Expired.
- **Saklar Mock**: Dukung mode offline dengan MSW (`VITE_USE_MOCKS=true`) dan mode API sungguhan (`VITE_USE_MOCKS=false`).

### B. Backend (`api/`) — Laravel (PHP 8.3/8.4)
- **Infrastruktur & Keamanan**:
  - Laravel Sanctum untuk API Token.
  - Konfigurasi CORS agar frontend React dapat berkomunikasi tanpa kendala.
  - Koneksi PostgreSQL NeonDB (`DB_CONNECTION=pgsql`, `DB_SSLMODE=require`).
  - Anti-SSRF: Validasi `base_url` console; tolak IP lokal/privat kecuali `ALLOW_PRIVATE_HOSTS=true` di lingkungan lokal.
  - Enkripsi kredensial console menggunakan `Crypt` bawaan Laravel; kredensial **tidak boleh** dikembalikan secara polos di API maupun log.
- **10 Tabel Portal & Relasi**:
  - `users`, `consoles`, `console_health_checks`, `log_sync_state`, `log_entries`, `processes`, `process_steps`, `process_runs`, `run_steps`, `audit_events`.
- **Autentikasi & Otorisasi**:
  - `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
  - Middleware `admin` untuk melindungi endpoint manajemen console, proses, dan audit.
- **Konektor Multi-Console (`app/Connectors/`)**:
  - Klien HTTP dengan 3 jenis autentikasi: `api_key`, `bearer` (login token cache 300s & refresh saat 401), dan `basic`.
  - Pemetaan error console ke format seragam: `CONSOLE_ERROR`, `CONSOLE_UNREACHABLE`, `CONSOLE_TIMEOUT`.
- **Sistem Log & Scheduler (`app/Services/LogSync.php` & Artisan Commands)**:
  - Perintah `logs:sync`: Normalisasi log dari 3 console (ISO UTC, Epoch Detik, dan WIB) menjadi format UTC standar.
  - Deduplikasi via kunci unik: `sha1(console_id + occurred_at + message)`.
  - Scheduler tiap menit untuk `logs:sync` dan `consoles:check`.
  - Perintah `logs:prune`: Menghapus log > 30 hari dan health checks > 7 hari.
- **Atur Data / Resources**:
  - Endpoint `/consoles/{id}/resources`: Membaca dan mengubah data, membatasi hanya field pada `writable_fields`, mencatat audit lama & baru.
- **Mesin Proses (`ExecuteRun`, `ProcessEngine`)**:
  - Pengganti templat nilai `{{input.*}}` dan `{{steps.N.response.body.*}}` dengan mempertahankan tipe data asli.
  - Queue worker job `ExecuteRun` pada antrean `runs`.
  - Auto-retry (hanya untuk status 429, 502, 503, 504 atau timeout).
  - Kompensasi: Dieksekusi berurutan terbalik (*reverse order*) untuk langkah sukses bila ada kegagalan proses (`compensate_on_failure = true`).
  - Ulangi dari langkah gagal (*retry*) dan pembatalan (*cancel*).
- **Audit Service**:
  - Service `Audit` mencatat aksi dengan format `objek.aksi` (contoh: `run.started`, `resource.updated`, `console.created`).
- **Pengujian (Tests)**:
  - Gunakan `Http::fake` untuk konektor dan mesin proses.
  - Minimal 1 pengujian per skenario utama: sukses, gagal di tengah jalan, kompensasi, batal, dan retry dari langkah gagal.

---

## 4. Perilaku Wajib untuk AI Agent

1. **Selalu Patuhi Kontrak API**:
   - Seluruh endpoint berada di bawah prefix `/api/v1`.
   - Format respons sukses: `{"data": ...}` atau `{"data": [...], "meta": {"next_cursor": ..., "total": ...}}`.
   - Format respons error: `{"error": {"code": "...", "message": "...", "console": "...", "fields": {}, "details": {}}}`.
2. **Pengecekan Kualitas Sebelum Selesai**:
   - Jalankan `npm test` di `web/` untuk memvalidasi frontend.
   - Jalankan `vendor/bin/pest` di `api/` untuk memvalidasi backend.
   - Pastikan tidak ada kredensial yang bocor di log atau kode.
3. **Konfirmasi Sebelum Mengubah Batasan**:
   - Jika pengguna meminta sesuatu yang masuk ke peran Cloud atau DB Schema, agen wajib mengingatkan pengguna mengenai batasan peran Fullstack sebelum melangkah lebih jauh.
