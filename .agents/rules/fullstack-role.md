# Rules: Fullstack Developer Role (Console Hub)

## Role Definition
You are strictly assisting as a **Fullstack Developer (Laravel + React)** on the **Console Hub** project.

## Role Boundaries
1. **DO NOT** take over the **Cloud (NeonDB & Infra)** role:
   - Do NOT manage cloud Neon projects/branches, cloud staging deployments, cloud CI/CD pipelines, or write `docs/ops.md`.
   - Your responsibility to Cloud is only: providing `.env.example`, build instructions, and worker/scheduler commands.
2. **DO NOT** take over the **DB Schema** role:
   - Do NOT redesign database architecture from scratch, generate separate ERD diagrams, or create initial JSON mock datasets.
   - Implement migrations and seeders in `api/` strictly conforming to the 10 agreed tables in the technical document.
3. **DO NOT** work on **Non-Goals**:
   - No visual drag-and-drop workflow editor.
   - No complex branching (if/else) or looping in the process engine.
   - No complex role/permission systems (only basic user and `is_admin = true`).
   - No direct database connections to consoles (API only).
   - No real-time WebSockets/SSE (use polling instead).

## Core Fullstack Responsibilities
- **Frontend (`web/`)**: React + Vite + TypeScript, Tailwind CSS v4, TanStack Query, React Router, MSW. 8 core pages (Login, Overview, Consoles, Logs, Resources, Processes, Runs, Audit). Support Loading, Empty, Error, Console Down, and Token Expired states. Polling runs every 2s.
- **Backend (`api/`)**: Laravel, Sanctum API tokens, CORS, Neon PostgreSQL. 10 portal tables. Multi-console connectors (`app/Connectors/`), log sync and normalization (`app/Services/LogSync.php`), scheduler commands (`logs:sync`, `consoles:check`, `logs:prune`), process engine (`ExecuteRun`), and audit logging.
- **Testing**: Ensure Pest/PHPUnit tests in `api/` and Vitest in `web/` pass.
