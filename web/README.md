# Console Hub — web

Frontend portal Console Hub (logistik dan inventaris). Satu aplikasi memakai tiga API sumber
(Gudang → Barang, Produksi → Produksi, HR → Personel) **lewat hub Laravel** (`api/`); browser
hanya memanggil hub di `/api/v1`, tidak pernah API sumber langsung.

Dua peran dalam satu aplikasi:

- **Admin IT**: ringkasan, sumber data, log gabungan, pengguna & izin, audit, dan data kerja.
- **User**: Beranda, Barang, Produksi, Personel, Lacak barang. Menu dan tombol mengikuti izin RBAC.

## Menjalankan

Butuh Node 20.19+ atau 22.12+ (Vite 8). Jalankan hub dulu (lihat `api/` dan
`tools/console-stub/README.md` untuk sumber pengganti di lokal).

```bash
npm install
cp .env.example .env     # VITE_API_URL=/api/v1
npm run dev              # http://localhost:5173, /api diteruskan ke VITE_PROXY_TARGET (bawaan 127.0.0.1:8000)
```

Produksi (Vercel): `vercel.json` meneruskan `/api/*` ke hub Railway dan semua rute lain ke
`index.html`, jadi `VITE_API_URL=/api/v1` tetap dan tidak perlu CORS.

## Skrip

| Perintah            | Fungsi                                                                                |
| ------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`       | Server dev, `/api` diteruskan ke hub                                                  |
| `npm run build`     | Typecheck + build produksi ke `dist/`                                                 |
| `npm run typecheck` | `tsc -b` (strict)                                                                     |
| `npm run lint`      | ESLint                                                                                |
| `npm test`          | Vitest + Testing Library + axe; hub palsu per uji (`src/test/api.ts`), tanpa jaringan |
| `npm run test:hub`  | Cek kontrak terhadap hub yang berjalan (`HUB_URL=…`, lihat `docs/integration.md`)     |
| `npm run format`    | Prettier                                                                              |

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
  test/           api.ts (hub palsu: adapter axios + fixture), admin.ts, utils.tsx (renderApp)
  lib/            permissions.tsx (hasPermission, useCan, <Can>), errors.ts, format.ts, status.ts
  styles/         tokens.css (token terang/gelap, skala Admin/User)
scripts/          contrast.test.ts (kontras AA token, kedua tema)
docs/             design-notes.md, integration.md, ideas.md, references/
```

## Catatan desain dan integrasi

- `docs/design-notes.md`: apa yang diambil dari tiap gambar referensi, dan setiap keputusan
  yang menyimpang dari brief beserta alasannya.
- `docs/integration.md`: integrasi dengan backend (selesai) dan cara memeriksa kontrak.
