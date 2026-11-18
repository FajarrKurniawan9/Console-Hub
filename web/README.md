# Console Hub — web

The frontend for Console Hub: one place to see combined logs, view and edit data in other consoles (HR, Gudang, Produksi), run and monitor cross-console processes, and read the audit log.

The frontend only talks to the portal API (`/api/v1`), never to the consoles directly. Until the Laravel backend is ready, every response comes from a mock (MSW) that follows the same contract.

## Running it

Requires Node 20.19+ or 22.12+ (Vite 8).

```bash
npm install
cp .env.example .env     # VITE_API_URL=/api/v1, VITE_USE_MOCKS=true
npm run dev              # http://localhost:5173
```

Log in with a mock account (dummy data, no real service involved):

| Email                      | Password    | Role                   |
| -------------------------- | ----------- | ---------------------- |
| `rina@pabrik-sejahtera.id` | `konsol123` | Admin (can open Audit) |
| `budi@pabrik-sejahtera.id` | `konsol123` | Operator               |

## Scripts

| Command             | What it does                                                                     |
| ------------------- | -------------------------------------------------------------------------------- |
| `npm run dev`       | Dev server with mocks                                                            |
| `npm run build`     | Typecheck + production build to `dist/`                                          |
| `npm run typecheck` | `tsc -b` (strict)                                                                |
| `npm run lint`      | ESLint                                                                           |
| `npm run test`      | Vitest + Testing Library; the mock runs on an MSW Node server, no network needed |
| `npm run format`    | Prettier                                                                         |

## Mock scenarios

Pick one with `?scenario=<name>` in the URL (it is remembered for the tab), or with the **skenario mock** panel at the bottom left (dev mode only).

| Scenario           | What happens                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `ok`               | Everything normal (default). Web Gudang is "Lambat" (2.4 s).                                                               |
| `slow`             | Every request is delayed 1–4 s: skeletons show up.                                                                         |
| `gudang-down`      | Web Gudang is down: global bar, Gudang logs stop, Gudang data returns `CONSOLE_UNREACHABLE`, process steps on Gudang fail. |
| `all-down`         | All three consoles are down.                                                                                               |
| `empty`            | No logs, processes, runs or audit entries.                                                                                 |
| `unauthenticated`  | Every call after login returns 401: the session ends and you go back to the login page.                                    |
| `validation-error` | Saving data and the process run form return 422 with `fields`.                                                             |
| `run-fails`        | Every run fails at step 2 (step 1 is compensated when the process has compensation).                                       |
| `rate-limited`     | ~30% of requests return 429 at random.                                                                                     |

Other things worth trying:

- **Live run:** Proses → _Pesanan produksi baru_ → Jalankan. `qty` up to 100 succeeds; `qty` > 100 fails at step 2 (`INSUFFICIENT_STOCK`, with a shortages table) and step 1 is compensated.
- **"Log baru" marker:** keep `/logs` open; new logs arrive every 20–30 s.
- **Retry from the failed step:** `?scenario=gudang-down`, run _Nonaktifkan karyawan keluar_, switch back to `ok`, then click "Ulangi dari langkah gagal".

## Switching to the real backend

Change `.env` only; no component needs to change:

```bash
VITE_USE_MOCKS=false
VITE_API_URL=https://portal.example.internal/api/v1
```

Requirements on the backend side:

- Follows the contract in the technical document (envelopes `{ data }` / `{ data, meta: { next_cursor, total } }`, error `{ error: { code, message, console?, fields?, details? } }`). Every response is validated with zod in `src/lib/schemas.ts`; a mismatch shows as the `CONTRACT_MISMATCH` error, so it's never silently wrong.
- CORS allows the frontend's origin with the `Authorization` header, or put the API on the same origin (reverse proxy).
- Optional but recommended: `Console.down_since` (see `docs/design-notes.md` #8).

The token is stored in memory + `sessionStorage` (it disappears when the tab is closed). A 401 from any request clears the token and sends you to the login page.

## Structure

```
src/
  app/            router, providers, layout (sidebar, top bar, down/offline bars), guards
  components/ui/  thin Radix wrappers (shadcn style) using the design tokens
  components/     StatusDot, LevelBadge, ConsoleChip, JsonView, EmptyState, ErrorState, ...
  features/       auth, overview, consoles, logs, resources (Data console), processes, runs, audit
  lib/            api.ts (single client), schemas.ts (contract), errors.ts, runs.ts (retry/cancel rules), format.ts
  mocks/          handlers/, data/ (seeded dummy data), scenarios.ts
  styles/         tokens.css (light/dark tokens + Tailwind v4 theme)
docs/
  design-notes.md reference notes and decisions that deviate from the brief
  ideas.md        ideas outside this phase's scope
  references/     reference screenshots
```

## Design notes

See `docs/design-notes.md`: what was taken from each reference (n8n, Airflow and Backstage are **not** in the folder), and every decision that deviates from the brief, with its reason.
