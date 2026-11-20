# Console Hub — Bruno Collection

Ready-to-use [Bruno](https://www.usebruno.com/) API collection covering all 4 Laravel backends in this repository:

1. **01-Portal-Hub** (`api/`) — Portal API v1 (Sanctum Bearer auth + RBAC)
2. **02-Console-HR** (`api-hrd/`) — HR Console API (`X-Service-Key`)
3. **03-Console-Gudang** (`api-gudang/`) — Gudang Console API (`X-Service-Key`)
4. **04-Console-Produksi** (`api-produksi/`) — Produksi Console API (`X-Service-Key`)

## Quick Start

1. Open Bruno and choose **Open Collection** -> select this `bruno/` folder.
2. Select an environment (**Local** or **Staging**) in the top-right dropdown.
3. Open **Environments -> Configure** and fill in the secret variables (stored locally by Bruno, never committed to Git):
   - `login_password` — seeded password from `api/.env` (`SEED_ADMIN_PASSWORD` or `SEED_USER_PASSWORD`)
   - `hr_service_key` — `HR_SERVICE_KEY` from `api-hrd/.env`
   - `gudang_service_key` — `GUDANG_SERVICE_KEY` from `api-gudang/.env`
   - `produksi_service_key` — `PRODUKSI_SERVICE_KEY` from `api-produksi/.env`
4. Run **01-Portal-Hub -> 01-Auth -> Login**. The post-response script automatically saves `data.token` into `portal_token` for all authenticated Portal requests.
5. `Create` / `Get` / `Update` / `Deactivate` requests automatically save `*_id` and `*_version` environment variables so you can test CRUD and tracking flows sequentially.
