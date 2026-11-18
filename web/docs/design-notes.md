# Design notes

## Reference images

The original screenshots are in `../docs/refrences/` (`image*.png`, generic names). Each one was opened, identified, and copied to `docs/references/` under the name from the brief's table. Images with no matching name in the table got a descriptive name.

| File                         | Original           | What I took from it                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plausible-clean.png`        | `image.png`        | A row of figures with small uppercase labels and short numbers, a single filter + time-range control in the top right, plenty of white space. I took the typographic discipline; I left out the chart.                                                                       |
| `plausible-sites.png`        | `image copy 3.png` | The site list: name + one main figure + a muted caption. A model for a short console card. I left out the sparkline and the purple button.                                                                                                                                   |
| `grafana-logs.png`           | `image copy 2.png` | At the bottom right (the "Latest Support Tickets" panel): log rows with a monospace timestamp, a `>` icon to expand, and an expanded detail box. This is the pattern for the log table and its detail panel. I left out the panels, gauges, and charts.                      |
| `grafana-dashboard-edit.png` | `image copy.png`   | Filters as compact "label + value" pairs above the content (userGroup / engineName), plus a time-range picker and a "Refresh" button side by side. This is the pattern for the filter row on the logs page. I left out the chart panels, the editor, and the yellow accents. |
| `homepage-status.png`        | `image copy 5.png` | Short service cards: name, one-line description, a small green dot top right, latency in `ms`. The pattern for the console status cards on the overview. I left out the brand icons and background.                                                                          |
| `homepage-status-alt1.png`   | `image copy 4.png` | A variant of the above with "RUNNING" labels and latency in the card corner. It confirms that latency goes in small mono text. Its photo background and glass look are on the banned list.                                                                                   |
| `homepage-status-alt2.png`   | `image copy 6.png` | A grouped variant. Not used beyond confirming the pattern; its purple gradient background is banned.                                                                                                                                                                         |
| `vantage-unified.png`        | `image copy 8.png` | One overview page that summarizes many sources, each section with a "View Report" button that links to its full page. This is the "the portal summarizes, the original tool holds the detail" pattern. I left out the charts.                                                |
| `vantage-filters.png`        | `image copy 7.png` | A filter row (Filters, Custom range, date) and a multi-select dropdown with checkboxes. The pattern for console/level multi-select. I left out the marketing banner and purple.                                                                                              |
| `vantage-dashboards.png`     | `image copy 9.png` | Nothing new beyond the two above. A "Reset / Clear Filters" button next to the filters, which I use as "Hapus filter".                                                                                                                                                       |

**Missing** (no matching file in the folder, so nothing was invented from them):

- `n8n-executions.png`, `n8n-execution-detail.png`: missing. The transaction list and detail are designed from the brief's text (§8.5).
- `airflow-grid.png`: missing. The three-box console strip on a transaction is designed from the text.
- `backstage-catalog.png`: missing.
- `linear-or-notion-simple.png` (brief v3, the User view reference): missing. The User shell follows the brief's text (§4 and §8.2): roomy, top navigation, one primary button per page.

## Brief v3 (replaces v2)

v3 replaces the v2 product (processes, runs, the resource editor) with: two roles, RBAC, the work screens Karyawan/Divisi/Barang/Pesanan, and writes as transactions across three consoles. The v2 features and their mock data were deleted. Notes from v2 that no longer apply were removed; git history has them.

## Deviations and decisions

1. **v3 over the project CLAUDE.md.** CLAUDE.md lists "complex role & permission management" as a non-goal and expects /processes and /runs. The user chose to follow brief v3 (RBAC matrix, transactions) and leave CLAUDE.md unchanged.
2. **Folder `web/`, not `portal-web/`.** Reworked in place (user's choice). The tooling, tokens, `components/ui`, the API client, and the console/log/audit screens were kept and adapted.
3. **React 19, not 18.** The scaffold already had React 19 + React Router 8; every library in the stack supports it.
4. **shadcn/ui without the CLI.** `components/ui/` holds thin wrappers over `radix-ui`, styled with the tokens.
5. **axios kept** inside `lib/api/client.ts`. All responses are validated with zod (`lib/api/schemas.ts`).
6. **URLs in Indonesian** per brief v3 (`/console`, `/log`, `/transaksi`, `/konsistensi`, `/karyawan`...), except `/login`, `/rbac`, `/audit` which the brief also uses.
7. **`AuthUser.role.code` is a `string`**, not `'admin_it' | 'user'`: the RBAC screen can hold more roles (the mock has a third, "User (tanpa buat pesanan)"). The shell is chosen by the `admin.dashboard.view` permission, as the brief says, never by the role code.
8. **`?verify=all` response shape is assumed** (brief 8.5 names it but section 5 has no type): `consistency: { in_sync, consoles: [{ console, version, status }] }`. To be confirmed with the backend.
9. **No `ConsoleInfo.down_since`.** The v3 contract does not have it, so "sejak" uses `last_checked_at` (when the portal last saw it down). Less precise; a backend field would fix it.
10. **`Idempotency-Key`** is added by the client on every POST/PATCH/PUT/DELETE except login/logout. Callers pass the key per user intent, so a retry of the same intent reuses it.
11. **Client-only error codes** `NETWORK` and `CONTRACT_MISMATCH` (no response; response does not match the schema).
12. **Error copy per role** (`lib/errors.ts`): Admin IT gets technical copy plus the code and HTTP status; User gets plain sentences and, as the brief says, the API's `error.message` as is. Console names, codes and JSON never appear in the User shell.
13. **Shell sizes via CSS variables.** `[data-shell='user']` changes the type scale (15/22 px) and control height (40 px); components use `text-dense`, `h-control` and so on, and need no role prop.
14. **Mock isolation.** All mock code lives in `web/mocks/`. `src/` imports it only in the `// MOCK-ONLY` block of `src/main.tsx` and in tests named `*.mock.test.ts(x)`. The MSW server for Vitest is wired in `mocks/vitest.setup.ts`, not in `src/test/setup.ts`. The scenario panel is mounted by `mocks/browser.ts` and reloads the page on change.
15. **Login hint removed.** The old login page printed the mock accounts; that would leak mock data into `src/`. The accounts are in the README instead.
16. **Mock console names** are "HR", "Gudang", "Produksi" (the brief's names), not "Web HR".
17. **Placeholders during the phases.** Screens of later phases render `app/NotBuiltYet.tsx` ("Layar ini dibangun pada fase N"). It is removed once phase 4 is done.
18. **Build chunks:** vendor code is split (react, ui, vendor, mocks) so no chunk goes over 500 kB. The `mocks` chunk is only loaded when `VITE_USE_MOCKS=true`.
