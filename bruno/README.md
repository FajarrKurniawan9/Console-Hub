# Console Hub — Bruno Collection

Ready-to-use [Bruno](https://www.usebruno.com/) API collection (compatible with Bruno Desktop & Bruno VS Code Extension) covering all 4 Laravel backends in this repository:

1. **01-Portal-Hub** (`api/`) — Portal API v1 (Sanctum Bearer auth + RBAC)
   - **01-Auth**: Health Up, Login, Me, Logout, Email OTP Login (`request-otp` / `verify-otp`), Self-Registration OTP (`register/request-otp` / `register/verify`), Google OAuth (`redirect` / `exchange`)
   - **02-Items**, **03-Productions**, **04-People**, **05-Tracking**
   - **06-Admin**: Overview, Consoles CRUD & Test, Logs & Sync, RBAC Users / Roles (incl. Create & Delete Role) / Permissions, Audit Events
   - **07-Dashboard**: Items Dashboard (`GET /api/v1/dashboard/items`)
   - **08-Reports**: Immediate Export, Scheduled / Recurring Cron Exports, Waiting List / Scheduled / History filters, Cancel, and Download
2. **02-Console-HR** (`api-hrd/`) — HR Console API (`X-Service-Key`)
3. **03-Console-Gudang** (`api-gudang/`) — Gudang Console API (`X-Service-Key`)
4. **04-Console-Produksi** (`api-produksi/`) — Produksi Console API (`X-Service-Key`)

## Quick Start

1. Open Bruno (Desktop or VS Code Extension) and choose **Open Collection** -> select this `bruno/` folder.
2. Select an environment (**Local** or **Staging**) in the top-right dropdown.
3. Open **Environments -> Configure** and fill in the secret variables (stored locally by Bruno, never committed to Git):
   - `login_password` — seeded password from `api/.env` (`SEED_ADMIN_PASSWORD` or `SEED_USER_PASSWORD`)
   - `hr_service_key` — `HR_SERVICE_KEY` from `api-hrd/.env`
   - `gudang_service_key` — `GUDANG_SERVICE_KEY` from `api-gudang/.env`
   - `produksi_service_key` — `PRODUKSI_SERVICE_KEY` from `api-produksi/.env`
4. Run **01-Portal-Hub -> 01-Auth -> Login**. The post-response script automatically saves `data.token` into `portal_token` for all authenticated Portal requests.
5. `Create` / `Get` / `Update` / `Deactivate` requests automatically save `*_id` and `*_version` environment variables so you can test CRUD, tracking, RBAC, and report export flows sequentially.

## Testing Cron Job & Scheduled Report Exports (`08-Reports`)

Scheduler commands in `api/routes/console.php`:
- `logs:sync` (every minute)
- `consoles:check` (every minute)
- `reports:process` (every minute — promotes due one-time schedules, spawns child runs for due recurring cron schedules, sweeps pending FIFO queue, and fails stuck jobs > 15m)
- `logs:prune` & `reports:prune` (daily)

### Local Background Workers
Start the API server, queue worker, and scheduler in separate terminals inside `api/`:

```bash
php artisan serve --port=8000
php artisan queue:work --queue=exports,default --sleep=3 --tries=1
php artisan schedule:work
```

*(On Staging/Railway, `api/nixpacks.toml` already runs `queue:work`, `schedule:work`, and `serve` together.)*

### Step-by-Step Cron Check in Bruno

1. **Login**: Run `01-Portal-Hub -> 01-Auth -> Login` (as an account with `admin.audit.view`, `admin.logs.view`, or `barang.view`).
2. **Create a 1-minute recurring cron job**: Run `08-Reports -> Schedule Export (Cron Every Minute)` (`cron_expression: "* * * * *"`).
   - Expect `202 Accepted`, `status: "scheduled"`, `schedule_type: "recurring"`.
   - `scheduled_export_id` is saved automatically.
3. **Inspect scheduled queue**: Run `08-Reports -> List Scheduled Exports` (`?status=scheduled`) and note `scheduled_at`.
4. **Wait ~1 minute** (or trigger immediately in `api/` via `php artisan reports:process`).
5. **Verify cron execution**:
   - Re-run `08-Reports -> List Scheduled Exports`: `scheduled_at` should have advanced to the next minute.
   - Run `08-Reports -> List Export History` (`?status=history`): a child run with `parent_export_id` equal to your `scheduled_export_id` and `status: "completed"` should appear (`download_export_id` is auto-saved).
6. **Download generated file**: Run `08-Reports -> Download Export` (`200 OK` with file stream).
7. **Stop the every-minute test schedule**: Run `08-Reports -> Cancel Scheduled Export` (`200 OK`, `status: "cancelled"`).

You can also test:
- **One-time scheduled export**: `Schedule Export (One-Time)` auto-computes `scheduled_at` to 2 minutes in the future via `script:pre-request`.
- **Preset recurring schedule**: `Schedule Export (Preset)` converts `daily` / `weekly` / `monthly` + `schedule_time` to a 5-field cron expression (e.g. `0 8 * * *`).
- **Immediate queue & cancellation**: `Create Export (Immediate)` + `List Active Exports` + `Cancel Pending Export` (if worker is paused).
