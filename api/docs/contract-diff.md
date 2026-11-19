# Contract diff: frontend `web/src/lib/api/schemas.ts` vs backend hub (update 1)

Rule: the JSON shape follows the **frontend** (zod schemas are parsed at runtime). Source API fields
(`kontrak-3-api-console-hub-v1.md`) already use the same names, so Resources mostly pass them through
and add the merged parts.

Status: phase A (desk comparison, after removing the transaction code). "To do" rows are fixed in the
phase named.

## Envelope and errors

| Item | Backend today | Frontend | Resolution |
|---|---|---|---|
| List meta | `{next_cursor, total}` | `{next_cursor, unavailable?, total?}` | Add `unavailable` on merged lists (phase D) |
| Error body | `{code, message, console, fields, details}` | `{code, message, details?}`; zod strips extra keys | To do (phase C): validation fields move to `details.fields`; drop `console`/`fields` keys |
| Validation | `422 VALIDATION_FAILED`, `error.fields` | `VALIDATION_ERROR`, `details.fields` | To do (phase C): follow frontend and brief §6.1 |
| Server error | `500 INTERNAL_ERROR` | `SERVER_ERROR` | To do (phase C) |
| Source errors | `CONSOLE_ERROR`/`CONSOLE_UNREACHABLE` 502, `CONSOLE_TIMEOUT` 504 | `SOURCE_UNREACHABLE` 502, `SOURCE_TIMEOUT` 504 (no `SOURCE_ERROR`) | To do (phase C): any non-2xx a source should not send maps to `SOURCE_UNREACHABLE` |
| New codes | — | `REFERENCE_NOT_FOUND` 422, `REFERENCED` 409 (`details.used_by: [{source, type, id, name}]`) | Phase D |
| `VERSION_CONFLICT` | — | 409, passed through from the source API | Phase D |
| User vs Admin messages | — | User: everyday sentence, no source name/URL/id; Admin: `details.source`, `details.used_by` | Phase C/D |

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
| `ConsoleInfo {id, slug, name, base_url, is_active, status, latency_ms, last_checked_at}` | sends `last_latency_ms`, `last_error`, `auth_type`, `has_service_key`, `is_owner_of` | To do (phase C): rename `last_latency_ms` → `latency_ms`; replace `is_owner_of` with `resource`; extras are stripped by zod |
| `Overview {sources, log_errors_24h, recent_audit}` | Same (done in phase A) | — |
| `LogEntry {id, console, occurred_at, level, message, actor, raw?}` | also sends `tx_id` | Harmless extra (stripped). Column kept: log tables are not touched by update 1 |
| `ConsoleTest`, `LogSyncResult`, `RbacUser`, `RbacRole`, `AuditEvent` | Same | — |
| Self-protection RBAC | 409 `CONFLICT` | Same |

## Database name

Brief update 1 says `console-test`; `DatabaseGuard`, CLAUDE.md and Neon use `consolehub_test`.
Kept `consolehub_test` (renaming a database is the Cloud role's job).

## Open

1. `GET /items/kinds` is USULAN in the API contract and not in `schemas.ts`; the hub does not expose it.
