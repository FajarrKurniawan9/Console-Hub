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
17. **Placeholders during the phases** (`app/NotBuiltYet.tsx`) were removed in phase 4; every screen of the brief now exists.
18. **Build chunks:** vendor code is split (react, ui, vendor, mocks) so no chunk goes over 500 kB. The `mocks` chunk is only loaded when `VITE_USE_MOCKS=true`.

### Phase 2 (work screens)

19. **One write hook (`features/work/useWrite.ts`)** holds the brief's "perilaku menyimpan" for every screen: key per intent, 202 → poll every 2 s, refused / conflict / console / validation outcomes. Screens only pick the call and the success text. A refused, conflicting or invalid answer is final, so the next click is a new intent (new key); network errors and 429 keep the key so the retry is the same intent.
20. **202 polling** asks `GET /transactions/{id}` in the User shell and `GET /admin/transactions/{id}` in the Admin shell, as the brief says. Polling continues through failed polls (a failed poll is not an answer).
21. **202 ending in `needs_attention` or `aborted`** is shown in place with a business sentence (User) or the same sentence plus the transaction link (Admin). The brief only described the `committed` end.
22. **`VERSION_CONFLICT`, `LOCKED` and `CONFLICT` share one dialog** ("Muat ulang"). `CONFLICT` covers completing or cancelling an order that is no longer `ANTRE`.
23. **Deactivate = DELETE with `?expected_version=`**, behind a confirmation that explains the effect. The result (refusal etc.) is shown inside the same dialog.
24. **Item `jenis` cannot change after creation**: the SKU prefix (BB/BJ) depends on it. Not stated in the brief.
25. **Order form** sends `qty` as a number; an empty quantity is sent as `NaN` → JSON `null`, so the server reports it rather than the client silently sending 0. Lines show the available stock under the select.
26. **Reads come from the owner console** in the mock (Divisi/Karyawan: HR, Barang: Gudang, Pesanan: Produksi), so `gudang-down` breaks only the Barang list, as the brief describes.
27. **Mock 202:** the `slow` and `commit-stuck` scenarios return 202; `commit-stuck` makes Produksi fail its commit 3 times so the transaction ends in `needs_attention` (resolved from the Transaksi screen in phase 3).
28. **Portal shell attribute.** `data-shell="user"` is also set on `<html>` while the User shell is mounted, so dialogs and toasts (rendered in portals) get the User scale.

### Phase 3 (admin monitoring)

29. **Overview "Perlu perhatian"** merges `needs_attention`/`aborted` transactions from `recent_transactions` with the newest error logs; `needs_attention` always comes first, then by time, max 5. Counts per transaction state are one line of small text in the page header, not cards.
30. **Transaction detail polling:** `refetchInterval` is 2 s only while the state is not final (`committed`, `aborted`, `needs_attention`), and stops when the tab is hidden (`refetchIntervalInBackground: false`). The list polls every 4 s only while a visible row is still in flight.
31. **Three-box strip:** each box shows "Prepare" and the decision as dot + word. The decision row reads "Commit" or "Batal" depending on the transaction's decision, so an aborted transaction never shows "Commit: dibatalkan".
32. **Resolve** (`needs_attention`): both actions confirm first and say what happens. "Batalkan transaksi" also undoes consoles that had already committed. The endpoint answers 202; the page follows the result by polling. Not stated in the brief: a retry that still fails leaves the transaction in `needs_attention`.
33. **Log search matches `tx_id`** exactly, so the detail page links to "Log <console> untuk transaksi ini" (`/log?console=<id>&q=<tx_id>&range=7d`). The contract's `q` is described only as "kata kunci"; to be confirmed with the backend.
34. **Seeded mock history** (`mocks/engine/history.ts`): 40 transactions over 7 days, built on the current work data, with matching log lines carrying `tx_id`. Logs are re-numbered by time after inserting history so the cursor and "N log baru" stay correct.

### Phase 4 (consistency, RBAC, audit)

35. **Running a check and repairing a finding both answer 202.** The page polls the check every 2 s while it runs, and keeps polling the detail while a sent repair has not been reported back as repaired. A row being repaired shows "Memperbaiki…".
36. **A check fails** (status `failed`) when the owner or a replica console is down, rather than reporting partial findings.
37. **`?verify=all` panel:** in the Admin shell, a row in Divisi, Karyawan or Barang opens a side panel with the badge ("Sinkron di 3 console" / "Berbeda di Gudang") and the version per console. A console that is down shows "Tidak terjangkau" and the badge says "Tidak dapat dicek di …" instead of claiming a difference. Pesanan has no badge: orders are not replicated master data, and the consistency check only covers Divisi, Karyawan and Barang.
38. **RBAC matrix:** rows are resources, columns are actions, grouped Kerja / Admin. Cells exist only where the permission exists. The `admin.rbac.manage` box on Admin IT is checked and disabled, and the mock refuses the change too (409). Saving the role you are using reloads `me`, so your own menu follows at once; other users get it on their next `me`.
39. **Self-protection in user management:** you cannot deactivate yourself or move yourself to a role without `admin.rbac.manage` (the mock answers 409 with the reason).
40. **New users** get the shared mock password in the mock only (`initial_password` in the 201 body). The real backend should decide how first passwords are delivered; the UI does not show it.
41. **Audit filter "Pengguna"** now uses `GET /admin/rbac/users`, so it needs `admin.rbac.manage`. A role with `admin.audit.view` but without `admin.rbac.manage` gets an empty user filter (the table still works). A lighter user list endpoint would fix this; noted in `docs/ideas.md`.

### Phase 5 (finishing)

42. **Session expired** (401 on any call): the token is cleared and the login page says "Sesi Anda sudah berakhir"; after logging in you return to the page you were on. A `me` call that fails for another reason (network, 5xx) shows an error with "Coba lagi" instead of logging you out.
43. **403 reloads `me`.** A 403 from the API usually means our permissions are stale (changed server-side), so the client reloads `me` and menus follow. The screen shows the error in place.
44. **429 is retried once automatically** after 3 s (other 4xx never are). If it still fails, the error says to wait and offers "Coba lagi".
45. **User shell "layanan bermasalah" bar.** User cannot see console status, so the bar is derived from loaded data that failed with `CONSOLE_*`. It names no console.
46. **Focus return also covers unmounted dialogs.** Forms are mounted only while open, which skips Radix's `onCloseAutoFocus`; `useReturnFocus` captures the opener on first render and restores it on unmount.
47. **Accessibility checks.** `axe-core` (WCAG 2 A/AA rules) runs over 17 screens and the order form in tests. jsdom has no rendering, so colour contrast is checked separately on the tokens (`scripts/contrast.test.ts`, every text colour on `bg` and `surface`, both themes, ≥ 4.5:1). `axe-core` is pinned to 4.14.0 (4.14.1 was two days old).
48. **`forbidden` scenario** refuses Log, Audit, the Barang list and order creation with 403 even though the role allows them, to show what a stale permission looks like.

### Update 1 ("Jejak 3 console")

49. **Paths.** The update names `src/api/types.ts`; this project keeps the contract in `src/lib/api/schemas.ts` (with the client in `src/lib/api/client.ts`). The panel uses those types (`Transaction`, `TxParticipant`); no parallel types were added.
50. **Prerequisites already met in v3:** `GET /transactions/{id}` (owner only, `{ id, state, message? }`) and `DELETE /{sumber}/{id}?expected_version=N` as a query string (`useDeactivate`).
51. **One place hooks every form.** `useWrite` is the only write path, so it hands the transaction to the panel; no form was rewritten. The panel sits above the list (page slot provided by the shell), is not a modal, and closes only by hand. It belongs to the page it was made on.
52. **202 moved from the form to the panel.** Before, the form stayed locked on "Sedang diselesaikan…" while `useWrite` polled. Now the form closes with a toast ("… sedang diselesaikan") and the panel follows the transaction. Both polling the same transaction would have doubled the requests. The panel stops after 60 s without a final state and offers "Cek lagi".
53. **Variant by permission, not shell.** Admin variant needs `admin.transactions.view`; anyone else gets the User sentence from `GET /transactions/{id}` and never calls `/admin/*` (tested by recording every request path).
54. **Status words.** Rows use the update's words: Siap, Tersimpan, Ditolak, Tidak merespons, Dibatalkan; plus Menunggu (prepare not answered yet) and Menyelesaikan… (decided, commit pending). A commit that keeps failing (`needs_attention`) is shown as "Tidak merespons" on that console.
55. **Response time** is measured from the transaction's `created_at` to the console's last answer (`finished_at`, else `prepared_at`). The contract has no per-console latency; this is what the participant timestamps allow. A console that never answered shows "—".
56. **Version column** shows the saved row's version (from the write response) on consoles that saved it. The contract has no per-console version on a transaction, so it is the same number on each saved row; the per-console versions are what "Cek di 3 console" is for.
57. **`checksum` in `?verify=all`** is an added optional field (user's choice), shown as its first 8 characters (full value on hover). Still an assumption: confirm with the backend.
58. **"Cek di 3 console"** reuses the v3 detail side panel (no new `VerifyAllDialog`); the check now runs on demand from the button instead of on open. The badge reads "Sama di 3 console".
59. **`slow` scenario** now delays only Gudang (2–3.5 s; 0.6 s in tests) so one console clearly answers later, as the update asks.
60. **Demo accounts** moved from the login page to the mock dev panel (user's choice), so `src/` holds no dummy credentials.

## Update 2 (2026-11-19): domain logistik

Supersedes every note above about transactions, 202, `Idempotency-Key`, consistency checks,
Karyawan/Divisi/Pesanan, and the "Jejak 3 console" panel (all removed).

- **No `types.ts`.** Types are still inferred from the zod schemas in `lib/api/schemas.ts`, so the
  update-2 types live there (`Item`, `Production`, `Person`, `TrackingResult`, `SourceStatus`, …).
- **`details.fields`.** The update-2 error envelope has no top-level `fields`; the client reads
  `details.fields` either as `{field: [messages]}` (422 `VALIDATION_ERROR`) or as a list of field
  names (422 `REFERENCE_NOT_FOUND`), which then get the plain sentence from `lib/errors.ts`.
- **`meta.total` is optional.** Work lists only send `next_cursor` (+ `unavailable`); admin logs
  and audit keep sending `total`.
- **Writes are off only when the owning source is down** (`ListFrame` → `unavailableOf`): items
  need Gudang, productions Produksi, people HR. A down joined source only greys its column.
- **Merged column without data:** id present + ref `null` → "Tidak tersedia" with a tooltip;
  no id → "—".
- **"Dipakai oleh" on the person drawer** is not rendered: the contract has no field for it
  (update 2 says "only when the backend provides it").
- **Lacak Barang loading:** one request covers all three sources, so "per-section loading" is a
  skeleton in each of the three steps while that request runs.
- **Row Enter fix:** Enter on a table row now calls `preventDefault`, otherwise the same key
  press activated the drawer's close button once focus moved into it.
