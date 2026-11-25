# Contract diff: frontend `web/src/lib/api/schemas.ts` vs backend hub (update 1)

Rule: the JSON shape follows the **frontend** (zod schemas are parsed at runtime). Source API fields
(`kontrak-3-api-console-hub-v1.md`) already use the same names, so Resources mostly pass them through
and add the merged parts.

Status: phases A-F done. "To do" rows are fixed in the
phase named.

## Envelope and errors

| Item | Backend today | Frontend | Resolution |
|---|---|---|---|
| List meta | `{next_cursor, total}` | `{next_cursor, unavailable?, total?}` | Done (phase D): `unavailable` only when a merged source was down |
| Error body | `{code, message, console, fields, details}` | `{code, message, details?}`; zod strips extra keys | Done (phase C): `{code, message, details}` |
| Validation | `422 VALIDATION_FAILED`, `error.fields` | `VALIDATION_ERROR`, `details.fields` | Done (phase C) |
| Server error | `500 INTERNAL_ERROR` | `SERVER_ERROR` | Done (phase C) |
| Source errors | `CONSOLE_ERROR`/`CONSOLE_UNREACHABLE` 502, `CONSOLE_TIMEOUT` 504 | `SOURCE_UNREACHABLE` 502, `SOURCE_TIMEOUT` 504 (no `SOURCE_ERROR`) | Done (phase C): any unexpected non-2xx maps to `SOURCE_UNREACHABLE`; Admin gets `details.source`, User an everyday sentence |
| New codes | — | `REFERENCE_NOT_FOUND` 422, `REFERENCED` 409 (`details.used_by: [{source, type, id, name}]`) | Done (phase D): `REFERENCE_NOT_FOUND` sends `details.fields.<field>: [sentence]`; `used_by` only for `admin.consoles.view` |
| `VERSION_CONFLICT` | — | 409, passed through from the source API | Done (phase D), with `details.current_version` when the source sends it |
| User vs Admin messages | — | User: everyday sentence, no source name/URL/id; Admin: `details.source`, `details.used_by` | Done |

## Auth

Unchanged: `AuthUser {id, name, email, role:{code,name}, permissions}`, login/logout/me.
Permission codes now match `PERMISSIONS` in `schemas.ts` exactly (`Permission::ALL`).

## Work data (merged from three sources)

| Frontend | Source API | Notes |
|---|---|---|
| `Person {id, name, role, status, version, created_at, updated_at}` | HR `/people` | Pass-through |
| `Production {…, courier_id, courier: PersonRef\|null}` | Produksi `/productions` + HR `?ids=` | `courier` null when unset, not found, or HR down |
| `Item {…, production_id, production: ProductionRef\|null, responsible_id, responsible: PersonRef\|null, quantity, unit}` | Gudang `/items` + Produksi/HR `?ids=` | `quantity`/`unit` are USULAN in the API contract; frontend requires them (`quantity` number, `unit` string) |
| `TrackingResult {item, production, responsible, courier, warnings, sources?}` | three sources | `sources` only with `admin.consoles.view`; `SourceStatus.latency_ms` nullable |
| `PersonRef {id, name, role}`, `ProductionRef {id, area, production_type}` | — | Built by the hub |

## Admin

| Frontend | Backend today | Resolution |
|---|---|---|
| `ConsoleInfo {id, slug, name, base_url, is_active, status, latency_ms, last_checked_at}` | sends `last_latency_ms`, `last_error`, `auth_type`, `has_service_key`, `is_owner_of` | Done (phase B): `latency_ms`, `is_active`, `resource`; extras stripped by zod |
| `Overview {sources, log_errors_24h, recent_audit}` | Same (done in phase A) | — |
| `LogEntry {id, console, occurred_at, level, message, actor, raw?}` | also sends `tx_id` | Harmless extra (stripped). Column kept: log tables are not touched by update 1 |
| `ConsoleTest`, `LogSyncResult`, `RbacUser`, `RbacRole`, `AuditEvent` | Same | — |
| Self-protection RBAC | 409 `CONFLICT` | Same |

## Database name

Brief update 1 says `console-test`; `DatabaseGuard`, CLAUDE.md and Neon use `consolehub_test`.
Kept `consolehub_test` (renaming a database is the Cloud role's job).

## Implementation notes

- One `SourceClient` class parameterised by resource stands in for the brief's `GudangClient`/`ProduksiClient`/`HrClient`: the three would differ only by path.
- One `RecordService` + `RecordController` (resource from the route default) instead of Item/Production/Person services and controllers; references live in `Enricher::JOINS`.
- Audit actions: `item|production|person.created|updated|deactivated`; `new_value.console` names the owner so the audit filter by console works.
- Tracker: HR is called once for the responsible person and once for the courier (latency summed in `sources`), as §8 describes.
- Source `DUPLICATE` (production area + type) surfaces as 409 `CONFLICT` (not in the frontend enum).

## Open

1. `GET /items/kinds` is USULAN in the API contract and not in `schemas.ts`; the hub does not expose it.
2. **API contract gap (USULAN added to the contract):** `hub:seed-demo` writes through the hub with uuid v5 ids, but the contract's `POST` bodies have no `id`. Proposal: optional `id` on `POST` (implemented in `tools/console-stub`); the hub strips `id` from user requests. Needs Kak Jo and the three API builders to agree.

## Reports & Export Scheduler (added 2026-11-25)

- `GET /api/v1/reports/exports` (`perm:admin.audit.view,admin.logs.view,barang.view`): returns `{ data: ReportExport[] }`, combining the global FIFO active waiting list (`pending`/`processing` across users, with `queue_position`, `requester_name`, `is_mine`) followed by the authenticated user's own completed/failed history (max 50). Active tickets belonging to other users never expose `download_url`, `error_message`, `row_count`, or `completed_at`.
- `POST /api/v1/reports/export`: enforces per-type permission (`audit` -> `admin.audit.view`, `logs` -> `admin.logs.view`, `barang` -> `barang.view`), creates a `pending` ticket in `report_exports`, audits `report.export_requested`, dispatches `ProcessReportExport` to queue `exports`, and returns `202 Accepted` (`{ data: ReportExport }`).
- `GET /api/v1/reports/exports/{export}/download`: owner-only + per-type permission (`403`), `409 CONFLICT` if not completed, `404 NOT_FOUND` if expired/missing; streams CSV (UTF-8 BOM + formula protection), XLSX (OpenSpout), or JSON with `Content-Disposition: attachment` (exposed via CORS).
- Background runtime commands: `php artisan queue:work --queue=exports,default` and `php artisan schedule:work` (schedules `reports:process` every minute and `reports:prune` daily).

