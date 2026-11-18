# Console Hub — web

Portal frontend that controls three web consoles (HR, Gudang, Produksi). Each data change made from the portal is written to all three as one transaction: it either succeeds everywhere or is cancelled everywhere. The backend runs the protocol; the frontend sends the request and shows the result.

There are two roles in one app:

- **Admin IT**: the full, technical view (overview, consoles, combined logs, transactions, data consistency, RBAC, audit, work data).
- **User**: a simple work view (Karyawan, Divisi, Barang, Pesanan). Menus and buttons follow RBAC permissions.

The frontend only talks to the portal API (`/api/v1`). Until the Laravel backend is ready, every response comes from an MSW mock in `mocks/` that follows the contract (brief v3 §5).

## Running it

Requires Node 20.19+ or 22.12+ (Vite 8).

```bash
npm install
cp .env.example .env     # VITE_API_URL=/api/v1, VITE_USE_MOCKS=true
npm run dev              # http://localhost:5173
```

## Scripts

| Command             | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `npm run dev`       | Dev server (with mocks when `VITE_USE_MOCKS=true`)            |
| `npm run build`     | Typecheck + production build to `dist/`                       |
| `npm run typecheck` | `tsc -b` (strict)                                             |
| `npm run lint`      | ESLint                                                        |
| `npm run test`      | Vitest + Testing Library against the MSW Node server, offline |
| `npm run format`    | Prettier                                                      |

## Mock (removed at integration)

Mock accounts, dummy data only:

| Email               | Password    | Role                                 |
| ------------------- | ----------- | ------------------------------------ |
| `admin@example.com` | `demo12345` | Admin IT                             |
| `user@example.com`  | `demo12345` | User                                 |
| `siti@example.com`  | `demo12345` | User without `pesanan.create`        |
| `agus@example.com`  | `demo12345` | User, deactivated (login is refused) |

Pick a scenario with `?scenario=<name>` in the URL (remembered for the tab) or with the **skenario mock** panel at the bottom left:
`ok`, `slow`, `gudang-down`, `all-down`, `commit-stuck`, `drift`, `empty`, `unauthenticated`, `forbidden`, `validation-error`, `rate-limited`. The full table is in brief v3 §9; scenarios that need later phases take effect as those phases land.

## Structure

```
src/
  app/            router, providers, AdminLayout, UserLayout, guards (RequireAuth, RequirePermission)
  components/ui/  thin Radix wrappers (shadcn style) using the design tokens
  components/     StatusDot (+ TxStateBadge, LevelBadge), ConsoleChip, JsonView, EmptyState, ErrorState...
  features/auth/
  features/work/  Karyawan, Divisi, Barang, Pesanan (both roles)
  features/admin/ overview, consoles, logs, transactions, consistency, rbac, audit
  lib/api/        client.ts (single client), schemas.ts (contract types + zod)
  lib/            permissions.tsx (hasPermission, useCan, <Can>), errors.ts, format.ts, status.ts
  styles/         tokens.css (light/dark tokens, Admin/User scale)
mocks/            ALL mock code: handlers/, data/, scenarios.ts, DevPanel, browser.ts, node.ts
docs/             design-notes.md, ideas.md, references/
```

## Design notes

See `docs/design-notes.md`: what was taken from each reference image, and every decision that deviates from the brief.
