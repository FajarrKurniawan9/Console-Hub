# Multi-API RBAC Expansion and Item Transaction Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand RBAC with preset operational roles and dynamic role creation, and build an item transaction dashboard page with trend and distribution charts protected by dedicated permissions.

**Architecture:** 
1. Backend adds `'dashboard.view'` permission, preset roles (`manajer_gudang`, `staff_produksi`, `staff_hr`, `auditor`), and `POST /api/v1/admin/rbac/roles` endpoint.
2. Backend aggregates item transactions (created, updated, deactivated) from `audit_events` and quantity distribution from item inventory in `GET /api/v1/dashboard/items`.
3. Frontend updates Zod schemas, navigation, and `/rbac` tab with a "Tambah Peran" modal, and implements a responsive `/dashboard` page featuring interactive SVG-based charts.

**Tech Stack:** Laravel 11, PostgreSQL (Neon), React 19, TypeScript, Tailwind CSS v4, TanStack Query v5, Zod v4, Lucide React, Vitest, Pest.

---

## Global Constraints
- Strictly follow the Fullstack role (Laravel + React) in `AGENTS.md`. Do not bypass sandbox or directly touch external databases.
- Keep JSON response envelope consistent: `{ "data": ... }` or `{ "error": { "code": "...", "message": "...", "details": {...} } }`.
- All routes under `/api/v1` with permission checking via `perm:kode`.
- Dark and light theme consistency using Tailwind CSS variables (`--bg`, `--surface`, `--text`, `--accent`, `--border`, `--ok`, `--warn`, `--error`).

---

### Task 1: Backend Cleanup & RBAC Role/Permission Expansion

**Files:**
- Modify: `api/routes/console.php` (remove dead `tx:recover` command)
- Modify: `api/app/Models/Permission.php`
- Modify: `api/database/seeders/PermissionSeeder.php`
- Modify: `api/database/seeders/RoleSeeder.php`
- Modify: `api/database/seeders/RolePermissionSeeder.php`
- Test: `api/tests/Feature/RbacTest.php`

**Interfaces:**
- Produces permission code `'dashboard.view'`.
- Produces seeded roles: `'admin_it'`, `'user'`, `'manajer_gudang'`, `'staff_produksi'`, `'staff_hr'`, `'auditor'`.

- [ ] **Step 1: Remove dead `tx:recover` line in `api/routes/console.php`**
- [ ] **Step 2: Add `'dashboard.view'` to `Permission::ALL` in `Permission.php` and `PermissionSeeder.php`**
- [ ] **Step 3: Add preset roles to `RoleSeeder.php` and default permissions in `RolePermissionSeeder.php`**
- [ ] **Step 4: Update `RbacTest.php` to assert new roles and permissions exist**

---

### Task 2: Backend Dynamic Role Creation Endpoint

**Files:**
- Create: `api/app/Http/Requests/RbacRoleCreateRequest.php`
- Modify: `api/app/Http/Controllers/Api/Admin/RbacController.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/RbacTest.php`

**Interfaces:**
- Produces: `POST /api/v1/admin/rbac/roles` with body `{ "name": string, "code": string }`, returns 201 with `RbacRoleResource`.

- [ ] **Step 1: Write test for creating a new role via `POST /api/v1/admin/rbac/roles` in `RbacTest.php`**
- [ ] **Step 2: Create `RbacRoleCreateRequest` with validation for `name` (min:2, max:60) and `code` (alpha_dash, unique:roles,code)**
- [ ] **Step 3: Implement `storeRole()` in `RbacController.php` and record audit event `rbac.role_created`**
- [ ] **Step 4: Register route in `api/routes/api.php` under `perm:admin.rbac.manage`**

---

### Task 3: Backend Dashboard Item Transaction API

**Files:**
- Create: `api/app/Http/Controllers/Api/DashboardController.php`
- Create: `api/app/Http/Resources/ItemDashboardResource.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/DashboardTest.php`

**Interfaces:**
- Produces: `GET /api/v1/dashboard/items?days=7|30` protected by `perm:dashboard.view`.
- Response format:
  ```json
  {
    "data": {
      "total_items": 15,
      "total_quantity": 450,
      "transactions_count": 28,
      "activity_trend": [
        { "date": "2026-11-20", "created": 2, "updated": 3, "deactivated": 0 }
      ],
      "kind_distribution": [
        { "kind": "kain", "count": 6, "total_quantity": 200 }
      ]
    }
  }
  ```

- [ ] **Step 1: Write feature test in `api/tests/Feature/DashboardTest.php`**
- [ ] **Step 2: Implement `DashboardController.php` querying `audit_events` and Gudang items**
- [ ] **Step 3: Register route `Route::get('dashboard/items', DashboardController::class)->middleware('perm:dashboard.view');`**

---

### Task 4: Frontend Schemas & Dynamic Role Creation UI in RBAC

**Files:**
- Modify: `web/src/lib/api/schemas.ts`
- Modify: `web/src/features/admin/rbac/queries.ts`
- Modify: `web/src/features/admin/rbac/matrix.ts`
- Modify: `web/src/features/admin/rbac/RolesTab.tsx`
- Test: `web/src/features/admin/admin.test.tsx`

**Interfaces:**
- Adds `'dashboard.view'` to `PERMISSIONS` and `matrix.ts`.
- Adds `useCreateRole` mutation hook in `queries.ts`.
- Adds "Tambah Peran" button and dialog in `RolesTab.tsx`.

- [ ] **Step 1: Add `'dashboard.view'` to `PERMISSIONS` in `schemas.ts` and `RESOURCE_LABEL` in `matrix.ts`**
- [ ] **Step 2: Add `itemDashboardSummary` Zod schema in `schemas.ts`**
- [ ] **Step 3: Add `useCreateRole` mutation in `web/src/features/admin/rbac/queries.ts`**
- [ ] **Step 4: Add "Tambah Peran" button and modal dialog to `RolesTab.tsx`**

---

### Task 5: Frontend Item Transaction Dashboard Page

**Files:**
- Create: `web/src/features/dashboard/DashboardPage.tsx`
- Create: `web/src/features/dashboard/queries.ts`
- Create: `web/src/features/dashboard/TrendChart.tsx`
- Create: `web/src/features/dashboard/KindChart.tsx`
- Modify: `web/src/app/nav.ts`
- Modify: `web/src/app/routes.tsx`
- Test: `web/src/features/dashboard/Dashboard.test.tsx`

**Interfaces:**
- Menu item `Dashboard` (`/dashboard`, icon `LayoutDashboard`, perm `dashboard.view`).
- Page renders KPIs, 7d/30d filter, Activity Trend bar chart, and Kind Distribution horizontal bar chart.

- [ ] **Step 1: Create `queries.ts` fetching `GET /dashboard/items?days=` with TanStack Query**
- [ ] **Step 2: Implement responsive, theme-aware SVG `TrendChart` and `KindChart` components**
- [ ] **Step 3: Implement `DashboardPage.tsx` with KPI cards and chart sections**
- [ ] **Step 4: Register `/dashboard` route in `routes.tsx` and menu item in `nav.ts`**
- [ ] **Step 5: Add tests in `Dashboard.test.tsx` for access control and chart rendering**

---

### Task 6: End-to-End Verification

**Files:**
- Run: `cd web && npm test`
- Verify: Full regression test passing across all existing and new test suites
