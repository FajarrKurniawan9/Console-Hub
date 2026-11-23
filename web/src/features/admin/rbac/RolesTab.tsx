import { CircleAlert, Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { Panel } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Spinner } from '../../../components/ui/Spinner'
import type { RbacRole } from '../../../lib/api/schemas'
import { toApiError } from '../../../lib/api/client'
import { describeError } from '../../../lib/errors'
import {
  ACTION_LABEL,
  ADMIN_ACTIONS,
  buildMatrix,
  LOCKED_FOR_ADMIN,
  WORK_ACTIONS,
  type MatrixRow,
} from './matrix'
import {
  useCreateRole,
  usePermissionList,
  useRbacRoles,
  useSaveRolePermissions,
} from './queries'

export function RolesTab() {
  const roles = useRbacRoles()
  const perms = usePermissionList()
  const [roleId, setRoleId] = useState<number | null>(null)
  const [addingRole, setAddingRole] = useState(false)
  const role = roles.data?.find((r) => r.id === roleId) ?? roles.data?.[0]

  if (roles.isPending || perms.isPending)
    return (
      <Panel>
        <RowsSkeleton rows={8} label="Memuat peran" />
      </Panel>
    )
  if (roles.isError || perms.isError)
    return (
      <Panel>
        <ErrorState
          error={roles.error ?? perms.error}
          onRetry={() => {
            void roles.refetch()
            void perms.refetch()
          }}
        />
      </Panel>
    )
  if (!role)
    return (
      <Panel>
        <EmptyState message="Belum ada peran." />
      </Panel>
    )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Peran" className="flex flex-wrap gap-1">
          {roles.data.map((r) => (
            <Button
              key={r.id}
              role="tab"
              aria-selected={r.id === role.id}
              variant={r.id === role.id ? 'primary' : 'secondary'}
              onClick={() => setRoleId(r.id)}
            >
              {r.name}
            </Button>
          ))}
        </div>
        <Button variant="secondary" onClick={() => setAddingRole(true)}>
          <Plus size={16} strokeWidth={1.5} aria-hidden />
          Tambah peran
        </Button>
      </div>
      {/* key: reset the draft when switching roles or after the server answers */}
      <RoleMatrix key={`${role.id}:${role.permissions.join()}`} role={role} all={perms.data} />
      {addingRole ? (
        <AddRoleModal
          onClose={() => setAddingRole(false)}
          onCreated={(newRole) => {
            setRoleId(newRole.id)
            setAddingRole(false)
          }}
        />
      ) : null}
    </div>
  )
}

function RoleMatrix({ role, all }: { role: RbacRole; all: string[] }) {
  const save = useSaveRolePermissions()
  const [draft, setDraft] = useState(() => new Set(role.permissions))
  const matrix = useMemo(() => buildMatrix(all), [all])
  const isAdminRole = role.code === 'admin_it'
  const dirty =
    draft.size !== role.permissions.length || role.permissions.some((p) => !draft.has(p))

  const toggle = (p: string) => {
    save.reset()
    setDraft((d) => {
      const n = new Set(d)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })
  }

  return (
    <Panel>
      <div className="flex flex-col gap-4 p-4">
        {isAdminRole ? (
          <p className="flex items-start gap-2 rounded-md border border-warn px-3 py-2 text-dense">
            <CircleAlert
              size={16}
              strokeWidth={1.5}
              className="mt-px shrink-0 text-warn"
              aria-hidden
            />
            Peran Admin IT tidak boleh kehilangan izin Kelola pengguna & izin (
            <span className="font-mono">{LOCKED_FOR_ADMIN}</span>); kotaknya dikunci agar selalu ada
            yang dapat mengatur izin.
          </p>
        ) : null}
        <MatrixTable
          title="Kerja"
          rows={matrix.work}
          actions={WORK_ACTIONS}
          draft={draft}
          role={role}
          onToggle={toggle}
        />
        <MatrixTable
          title="Admin"
          rows={matrix.admin}
          actions={ADMIN_ACTIONS}
          draft={draft}
          role={role}
          onToggle={toggle}
        />
        {save.isError ? (
          <p role="alert" className="text-dense text-error">
            {describeError(save.error, true).title}: {save.error.message}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted">
            {dirty ? 'Ada perubahan yang belum disimpan.' : 'Tidak ada perubahan.'}
          </span>
          <Button
            disabled={!dirty || save.isPending}
            onClick={() => setDraft(new Set(role.permissions))}
          >
            Kembalikan
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || save.isPending}
            onClick={() =>
              save.mutate(
                { id: role.id, permissions: [...draft] },
                { onSuccess: (r) => toast.success(`Izin peran ${r.name} disimpan`) },
              )
            }
          >
            {save.isPending ? <Spinner /> : null}
            {save.isPending ? 'Menyimpan…' : `Simpan izin ${role.name}`}
          </Button>
        </div>
      </div>
    </Panel>
  )
}

function MatrixTable({
  title,
  rows,
  actions,
  draft,
  role,
  onToggle,
}: {
  title: string
  rows: MatrixRow[]
  actions: string[]
  draft: Set<string>
  role: RbacRole
  onToggle: (p: string) => void
}) {
  const used = actions.filter((a) => rows.some((r) => r.cells[a]))
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="pb-1 font-semibold">{title}</legend>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr>
              <th
                scope="col"
                className="h-8 border-b bg-surface px-3 text-left text-xs font-semibold text-muted"
              >
                Sumber
              </th>
              {used.map((a) => (
                <th
                  key={a}
                  scope="col"
                  className="h-8 w-24 border-b bg-surface px-2 text-center text-xs font-semibold text-muted"
                >
                  {ACTION_LABEL[a] ?? a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.resource}>
                <th scope="row" className="h-9 border-b px-3 text-left font-normal">
                  {r.label}
                </th>
                {used.map((a) => {
                  const p = r.cells[a]
                  if (!p) return <td key={a} className="border-b" />
                  const locked = role.code === 'admin_it' && p === LOCKED_FOR_ADMIN
                  return (
                    <td key={a} className="border-b text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--accent)]"
                        checked={draft.has(p)}
                        disabled={locked}
                        onChange={() => onToggle(p)}
                        aria-label={`${r.label}: ${ACTION_LABEL[a] ?? a}`}
                        title={p}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </fieldset>
  )
}

function AddRoleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (r: RbacRole) => void
}) {
  const create = useCreateRole()
  const error = create.error ? toApiError(create.error) : null
  const err = (k: string) => (error?.code === 'VALIDATION_ERROR' ? error.fields[k]?.[0] : undefined)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const name = String(f.get('name') ?? '').trim()
    const code = String(f.get('code') ?? '').trim().toLowerCase()
    create.mutate(
      { name, code },
      {
        onSuccess: (role) => {
          toast.success(`Peran ${role.name} berhasil dibuat`)
          onCreated(role)
        },
      },
    )
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !create.isPending && onClose()}
      title="Tambah peran baru"
      description="Buat peran baru, lalu atur izin menu dan aksinya pada matriks perizinan."
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Nama Peran"
          name="name"
          placeholder="mis. Manajer Wilayah"
          required
          autoFocus
          error={err('name')}
        />
        <Field
          label="Kode Peran"
          name="code"
          placeholder="mis. manajer_wilayah"
          required
          hint="Gunakan huruf kecil, angka, atau garis bawah."
          error={err('code')}
        />
        {error && error.code !== 'VALIDATION_ERROR' ? (
          <p role="alert" className="text-dense text-error">
            {describeError(error, true).title}: {error.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={create.isPending}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : null}
            {create.isPending ? 'Menyimpan…' : 'Tambah peran'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
