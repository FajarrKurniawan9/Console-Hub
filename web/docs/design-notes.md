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

- `n8n-executions.png`: missing.
- `n8n-execution-detail.png`: missing.
- `airflow-grid.png`: missing.
- `backstage-catalog.png`: missing.

The run list and run detail are designed from the brief's text (§8.6) alone: a row per run with status, start time, duration, and actions; a horizontal step strip; a vertical step list with request and response.

## Deviations from the brief and why

1. **React 19, not 18.** The scaffold already had React 19 + React Router 8. Every library in the stack supports it. Downgrading would add work with no benefit to the user.
2. **shadcn/ui without the CLI.** The components in `components/ui/` are thin wrappers over `radix-ui` (already installed), written in the shadcn style (copy-paste code, styled with the tokens). The CLI would only add `cn`/`cva` files and dependencies we don't need.
3. **axios kept** inside `lib/api.ts`, since it was already a dependency. All responses are validated with zod there.
4. **Folder:** the brief says "from an empty folder", but `web/` already held an unfinished portal (GitHub/Weather/Crypto). The user chose: keep the tooling and replace the product.
5. **Token storage:** memory + `sessionStorage`, as the brief says (the old code used `localStorage`).
6. **Login page** at `/login` (the old code used `/masuk`). URLs stay in English, since the brief lists `/logs`, `/data`, and so on.
7. **Register** is gone: it is not in the brief's API contract.
8. **`Console.down_since` (assumed, optional).** The global bar has to say "tidak dapat dihubungi sejak 14:32", but the contract only has `last_checked_at`. The mock sends `down_since`; if the backend doesn't send it, the UI falls back to `last_checked_at`.
9. **Error `CONTRACT_MISMATCH` and `NETWORK`** are client-side codes (not in the contract). They are used when a response fails zod validation or the connection drops.
10. **Mock login:** `rina@pabrik-sejahtera.id` (admin) and `budi@pabrik-sejahtera.id` (operator), password `konsol123`. A mock token carries the user id, so it survives a page reload.
11. **Build chunks:** the vendor code is split (react, ui, vendor, mocks) so no chunk goes over 500 kB. The `mocks` chunk only loads when `VITE_USE_MOCKS=true`.
