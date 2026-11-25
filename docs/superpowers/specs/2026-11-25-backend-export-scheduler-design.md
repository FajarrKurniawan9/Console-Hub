# Backend Export Scheduler & Queue Design

**Date:** 2026-11-25  
**Scope:** Fullstack (`api/` Laravel + `web/` React)  
**Status:** Approved

## 1. Problem & Goal

The data export UI (`web/src/features/reports/`) previously fell back to browser `localStorage` simulation (`ch.mock_reports_exports`) and hardcoded dummy CSV generation whenever the portal backend returned 404. No export endpoints, persistence table, queue jobs, or scheduler commands existed in `api/`.

Goal: Move export queuing, background processing, real file generation (CSV, XLSX, JSON), and authenticated downloading entirely to the Laravel backend, then integrate the React frontend directly with zero client-side mock fallback.

## 2. Role Boundary Note (`AGENTS.md`)

This feature adds one new portal database table (`report_exports`) in `consolehub_test` (approved by the user, similar to `otp_codes`) and provides Artisan commands for queue/scheduler execution. No cloud infrastructure or direct external console DB access is touched; `barang` exports fetch records strictly through the official Gudang/Produksi/HR HTTP APIs via `RecordService`.

## 3. Architecture (Hybrid Queue + Scheduler with Atomic Claim)

### 3.1 Database Schema: `report_exports`
Columns:
- `id` (`bigIncrements`)
- `user_id` (`foreignId -> users.id`, `cascadeOnDelete`)
- `requester_role` (`string(60)`, nullable)
- `type` (`string(32)`) — `'audit' | 'logs' | 'barang'`
- `name` (`string(160)`)
- `format` (`string(16)`) — `'csv' | 'xlsx' | 'json' | 'pdf' | 'docx'`
- `status` (`string(20)`, default `'pending'`) — `'pending' | 'processing' | 'completed' | 'failed'`
- `filters` (`jsonb`, nullable)
- `file_path` (`string(255)`, nullable) — internal private disk path (never exposed directly)
- `row_count` (`unsignedInteger`, nullable)
- `error_message` (`text`, nullable)
- `started_at` (`timestampTz`, nullable)
- `completed_at` (`timestampTz`, nullable)
- `created_at`, `updated_at` (`timestampTz`)

Indexes:
- `(user_id, created_at)` for fast per-user history queries.
- `(status, id)` for global FIFO active queue queries and scheduler sweeps.

### 3.2 Storage & Dependencies
- Disk: `local` (`storage/app/private/exports/{Y}/{m}/export-{id}-{type}.{ext}`), private and never publicly served.
- Dependency: pure-PHP writers (`PureZipWriter`, `XlsxWorkbookWriter`, `DocxReportWriter`, `PdfReportWriter` — zero extra PHP extensions like `ext-zip` or `ext-gd` required so Railway Docker PHP images build cleanly).
- CORS: add `Content-Disposition` to `exposed_headers` in `api/config/cors.php`.

### 3.3 API Endpoints (`/api/v1`, middleware `auth:sanctum`, `active`)

1. `GET /api/v1/reports/exports`
   - Implements **Shared Active Waiting List + Private History (Option A)**:
     - Returns all globally active tickets (`status IN ('pending', 'processing')`) ordered with `processing` first then `pending` by `id ASC`, each annotated with 1-based `queue_position`.
     - Followed by the authenticated user's own finished history (`user_id = auth()->id()` and `status IN ('completed', 'failed')`), ordered `id DESC`, capped at 50 history rows.
   - Privacy guard: for active tickets owned by other users (`is_mine: false`), `download_url`, `file_url`, `error_message`, and `row_count` are always `null`.
   - Response shape: `{ "data": ReportExport[] }`.

2. `POST /api/v1/reports/export`
   - Validation:
     - `type`: required, `in:audit,logs,barang`
     - `format`: nullable, `in:csv,xlsx,json` (default `csv`)
     - `name`: nullable, `string`, `max:160`
     - `filters`: nullable, `array`
   - RBAC permission check per type:
     - `audit` → `admin.audit.view`
     - `logs` → `admin.logs.view`
     - `barang` → `barang.view`
     - Missing permission returns `403 FORBIDDEN`.
   - Creates `report_exports` row (`status = 'pending'`), logs `report.export_requested` in `audit_events`, dispatches `ProcessReportExport::dispatch($export->id)->onQueue('exports')`.
   - Returns `202 Accepted` with `{ "data": ReportExport }` including live `queue_position`.

3. `GET /api/v1/reports/exports/{export}/download`
   - Authorization: requires `$export->user_id === $user->id` AND the RBAC permission for `$export->type`; otherwise `403 FORBIDDEN`.
   - Status check: if `$export->status !== 'completed'`, returns `409 CONFLICT`.
   - File check: if `$export->file_path` is null or missing on `local` disk, returns `404 NOT_FOUND`.
   - Streams binary attachment with format-appropriate MIME type and sanitized filename in `Content-Disposition`.

### 3.4 `ReportExport` JSON Shape
Matches and extends `web/src/lib/api/schemas.ts`:
```json
{
  "id": 12,
  "type": "barang",
  "name": "Laporan Barang (XLSX)",
  "status": "pending",
  "format": "xlsx",
  "file_url": null,
  "download_url": null,
  "error_message": null,
  "row_count": null,
  "requester_role": "manajer_gudang",
  "requester_name": "Hendra Wijaya",
  "is_mine": true,
  "queue_position": 2,
  "created_at": "2026-11-25T03:00:00Z",
  "completed_at": null
}
```
When `status === 'completed'` and `is_mine === true`, `download_url` is `/reports/exports/{id}/download` (relative to `/api/v1`).

### 3.5 Background Processing, Data Extraction & File Writers
- **`ReportExportProcessor`**:
  - Atomic claim: `UPDATE report_exports SET status = 'processing', started_at = now() WHERE id = ? AND status = 'pending'`. If 0 rows updated, returns immediately (idempotent across queue worker + scheduler).
  - Extracts rows via `ReportDataExtractor` and writes via `ReportFileWriter`, then updates `status = 'completed'`, `file_path`, `row_count`, `completed_at`.
  - On exception: deletes any partial file, updates `status = 'failed'`, stores safe user-facing `error_message` (never leaking secrets, service keys, or stack traces), logs technical context safely.
- **`ReportDataExtractor`** (safety cap: 10,000 rows):
  - `audit`: streams `AuditEvent` matching `AuditController` filters (`user_id`, `console_id`, `action`, `from`, `to`).
  - `logs`: streams `LogEntry` matching `LogController` filters (`console_id` array/csv, `level` array/csv, `q`, `from`, `to`).
  - `barang`: paginates `RecordService::list('items', ...)` (`q`, `status`, `kind`, `limit=100`, up to 100 pages / 10,000 rows) via HTTP APIs only.
- **`ReportFileWriter`**:
  - `csv`: UTF-8 BOM + `fputcsv` + formula injection neutralization (prefixes `'` when leading char is `=`, `+`, `-`, `@`).
  - `xlsx`: streaming OpenSpout `Writer` (`OpenSpout\Writer\XLSX\Writer`).
  - `json`: pretty UTF-8 JSON array of associative row objects.
- **Queue & Scheduler**:
  - `ProcessReportExport` (`ShouldQueue`, queue `exports`, `$tries = 1`, `$timeout = 120`).
  - `reports:process` scheduled `everyMinute()->withoutOverlapping()`: fails tickets stuck in `processing` > 15 minutes, then processes `pending` tickets in FIFO `id ASC` order.
  - `reports:prune` scheduled `daily()`: deletes private export files and `report_exports` rows older than 7 days (`--days=7`).

### 3.6 Frontend Integration (`web/`)
- Remove `localStorage` queue simulation (`ch.mock_reports_exports`), artificial timer status progression, and hardcoded dummy CSV fallback in `web/src/features/reports/queries.ts`.
- Align `canExportType()` with backend RBAC permissions: `admin.audit.view` (audit), `admin.logs.view` (logs), `barang.view` (barang).
- Normalize `download_url` safely against Axios `baseURL` (`/api/v1`) and extract filename from `Content-Disposition` when present.
- Update `ExportWaitingListModal` to show `ErrorState` on fetch failure, global `#N` queue position badge, requester name + ownership indicator for shared active items, row count on completion, and download button only for the owner's completed tickets.
- Update `web/src/features/reports/reports.test.tsx` and `api/docs/contract-diff.md`.

### 3.7 Runtime Commands (Dev & Staging)
- Queue worker: `php artisan queue:work --queue=exports,default`
- Scheduler: `php artisan schedule:work` (local) / cron `php artisan schedule:run` (staging)
