# Scheduled Export (One-Time & Recurring Cron) & Cancellation Design

**Date:** 2026-11-25  
**Scope:** Backend only (`api/`), frontend will integrate later  
**Status:** Approved

## 1. Goal

Extend the backend report export system so users can schedule exports for a future timestamp (one-time) or on a recurring schedule (preset daily/weekly/monthly or 5-field cron expression), and cancel any `scheduled` or `pending` export before execution so it is removed from both the scheduler and the `jobs` queue.

## 2. Schema Changes (`report_exports`)

Migration `2026_11_25_000002_add_scheduling_and_cancellation_to_report_exports_table.php`:
- `schedule_type` (`string(20)`, default `'immediate'`) — `'immediate' | 'once' | 'recurring'`
- `cron_expression` (`string(64)`, nullable) — valid 5-field cron (parsed via `dragonmantank/cron-expression`)
- `timezone` (`string(64)`, default `'Asia/Jakarta'`)
- `scheduled_at` (`timestampTz`, nullable) — next due execution time in UTC
- `cancelled_at` (`timestampTz`, nullable)
- `parent_export_id` (`foreignId -> report_exports.id`, nullable, `nullOnDelete()`)
- Index `(status, scheduled_at, id)` (`idx_report_exports_status_scheduled_id`)

Ticket statuses: `scheduled`, `pending`, `processing`, `completed`, `failed`, `cancelled`.

## 3. API Endpoints (`/api/v1/reports/*`, middleware `auth:sanctum`, `active`, `perm:admin.audit.view,admin.logs.view,barang.view`)

### 3.1 `POST /api/v1/reports/export`
Backwards-compatible with immediate exports. Additional optional scheduling fields:
- One-time: `scheduled_at` (ISO-8601 datetime, must be strictly in the future).
- Recurring via preset: `schedule_preset` (`daily | weekly | monthly`), `schedule_time` (`HH:MM`, default `08:00`), `schedule_day_of_week` (`0–6`, default `1`), `schedule_day_of_month` (`1–28`, default `1`), `timezone` (valid PHP timezone, default `Asia/Jakarta`).
- Recurring via custom cron: `cron_expression` (valid 5-field cron expression), `timezone` (default `Asia/Jakarta`).
- Mutual exclusivity: `scheduled_at`, `cron_expression`, and `schedule_preset` cannot be combined (`422 VALIDATION_ERROR`).
- Scheduled tickets are stored with `status = 'scheduled'`, are NOT pushed to the `jobs` table until due, record audit `report.export_scheduled`, and answer `202 Accepted`.

### 3.2 `POST /api/v1/reports/exports/{export}/cancel`
- Authorization: owner only (`$export->user_id === $user->id`) AND active RBAC permission for `$export->type` (`403 FORBIDDEN` otherwise).
- Allowed statuses: `scheduled` or `pending` (`409 CONFLICT` if already `processing`, `completed`, `failed`, or `cancelled`).
- Atomically sets `status = 'cancelled'`, `cancelled_at = now()`.
- Deletes matching unreserved `ProcessReportExport` rows from the `jobs` table (`queue = 'exports'`).
- If cancelling a `recurring` schedule, also cancels any `pending` child tickets spawned by it and purges their queued jobs.
- Records audit `report.export_cancelled` and responds `200 OK` (`{ data: ReportExport }`).

### 3.3 `GET /api/v1/reports/exports`
- Default response order:
  1. Shared active waiting list (`pending`, `processing`) across all users in FIFO order with 1-based `queue_position`.
  2. Authenticated user's own `scheduled` tickets ordered by `scheduled_at ASC, id ASC` (`queue_position: null`).
  3. Authenticated user's own finished history (`completed`, `failed`, `cancelled`) ordered by `id DESC` (limit 50).
- Optional query filter: `?status=active|scheduled|history`.
- Resource adds `schedule_type`, `cron_expression`, `timezone`, `scheduled_at`, `cancelled_at`, `parent_export_id` (masked to `null` for non-owners where sensitive).

## 4. Scheduler Execution & Pruning

- `reports:process` (`everyMinute()->withoutOverlapping()`):
  1. `processDueScheduled()`:
     - For due `once` tickets: verifies owner is still active & still holds RBAC permission (else auto-cancels), atomically promotes `scheduled -> pending`, and dispatches `ProcessReportExport`.
     - For due `recurring` tickets: locks row inside DB transaction, verifies owner & permission (else auto-cancels), spawns a concrete child ticket (`status = pending`, `schedule_type = immediate`, `parent_export_id = $parent->id`), advances parent's `scheduled_at` to the next cron occurrence, and dispatches child job.
  2. `failStuck()` & `processPending()` (FIFO fallback).
- `reports:prune` (`daily()`): only prunes finished/cancelled tickets (`status NOT IN ('scheduled', 'pending', 'processing')`) older than `--days=7` so active schedules are never deleted.
