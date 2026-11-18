# Ideas (outside the brief's scope, not built)

- Link "Buka di console asli" on each data row, once the backend sends a URL per record.
- Field metadata from the backend (type, options, min) in `ConsoleResource`, so `FIELD_SPECS` on the client is no longer needed and division options don't need to be hardcoded.
- A small `GET /admin/users` (id + name only) under `admin.audit.view`, so the audit user filter does not depend on `admin.rbac.manage`.
- A consistency badge on order detail, if orders are ever replicated across consoles.
