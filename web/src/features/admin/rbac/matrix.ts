// Groups the flat permission list into a resource × action matrix (brief 8.6).

export interface MatrixRow {
  resource: string
  label: string
  /** action → permission code, for the actions this resource has. */
  cells: Record<string, string>
}

const RESOURCE_LABEL: Record<string, string> = {
  barang: 'Barang',
  produksi: 'Produksi',
  personel: 'Personel',
  lacak: 'Lacak barang',
  'admin.dashboard': 'Ringkasan',
  'admin.consoles': 'Sumber data',
  'admin.logs': 'Log gabungan',
  'admin.rbac': 'Pengguna & izin',
  'admin.audit': 'Audit',
}

export const ACTION_LABEL: Record<string, string> = {
  view: 'Lihat',
  create: 'Tambah',
  update: 'Ubah',
  delete: 'Nonaktifkan',
  manage: 'Kelola',
}

export const WORK_ACTIONS = ['view', 'create', 'update', 'delete']
export const ADMIN_ACTIONS = ['view', 'manage']

export function buildMatrix(permissions: string[]) {
  const rows = new Map<string, MatrixRow>()
  for (const p of permissions) {
    const i = p.lastIndexOf('.')
    const resource = p.slice(0, i)
    const action = p.slice(i + 1)
    const row = rows.get(resource) ?? {
      resource,
      label: RESOURCE_LABEL[resource] ?? resource,
      cells: {},
    }
    row.cells[action] = p
    rows.set(resource, row)
  }
  const all = [...rows.values()]
  return {
    work: all.filter((r) => !r.resource.startsWith('admin.')),
    admin: all.filter((r) => r.resource.startsWith('admin.')),
  }
}

/** The one permission Admin IT must keep, or nobody can manage permissions again. */
export const LOCKED_FOR_ADMIN = 'admin.rbac.manage'
