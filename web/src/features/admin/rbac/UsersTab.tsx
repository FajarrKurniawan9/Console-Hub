import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '../../../components/EmptyState'
import { ErrorState } from '../../../components/ErrorState'
import { Panel } from '../../../components/PageHeader'
import { RowsSkeleton } from '../../../components/Skeletons'
import { ActiveStatusDot } from '../../../components/StatusDot'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Select, SelectField } from '../../../components/ui/Select'
import { Spinner } from '../../../components/ui/Spinner'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import type { RbacRole, RbacUser } from '../../../lib/api/schemas'
import { toApiError } from '../../../lib/api/client'
import { describeError } from '../../../lib/errors'
import { useAuth } from '../../auth/auth'
import { useCreateUser, useRbacRoles, useRbacUsers, useUpdateUser } from './queries'

export function UsersTab() {
  const users = useRbacUsers()
  const roles = useRbacRoles()
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setAdding(true)} disabled={!roles.data}>
          <Plus size={16} strokeWidth={1.5} aria-hidden />
          Tambah pengguna
        </Button>
      </div>
      <Panel>
        {users.isPending ? (
          <RowsSkeleton rows={4} label="Memuat pengguna" />
        ) : users.isError ? (
          <ErrorState
            error={users.error}
            onRetry={() => void users.refetch()}
            retrying={users.isFetching}
          />
        ) : users.data.length === 0 ? (
          <EmptyState message="Belum ada pengguna." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nama</Th>
                <Th>Email</Th>
                <Th>Peran</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Aksi</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <UserRow key={u.id} user={u} roles={roles.data ?? []} />
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {adding && roles.data ? (
        <AddUser roles={roles.data} onClose={() => setAdding(false)} />
      ) : null}
    </div>
  )
}

function UserRow({ user: u, roles }: { user: RbacUser; roles: RbacRole[] }) {
  const { user: me } = useAuth()
  const update = useUpdateUser()
  const self = me?.id === u.id
  const done = (what: string) => ({ onSuccess: () => toast.success(`${u.name}: ${what}`) })
  return (
    <Tr className={u.is_active ? '' : 'text-muted'}>
      <Td className="font-semibold">
        {u.name}
        {self ? <span className="ml-1.5 text-xs font-normal text-muted">(Anda)</span> : null}
      </Td>
      <Td className="font-mono">{u.email}</Td>
      <Td>
        <label>
          <span className="sr-only">Peran {u.name}</span>
          <Select
            value={u.role.code}
            disabled={update.isPending || roles.length === 0}
            onChange={(e) =>
              update.mutate({ id: u.id, role_code: e.target.value }, done('peran diubah'))
            }
          >
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        </label>
        {update.isError ? (
          <p role="alert" className="pt-1 text-xs text-error">
            {update.error.message}
          </p>
        ) : null}
      </Td>
      <Td>
        <ActiveStatusDot status={u.is_active ? 'aktif' : 'nonaktif'} />
      </Td>
      <Td className="text-right">
        {self ? null : (
          <Button
            variant="ghost"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { id: u.id, is_active: !u.is_active },
                done(u.is_active ? 'dinonaktifkan' : 'diaktifkan'),
              )
            }
          >
            {update.isPending ? <Spinner /> : null}
            {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
        )}
      </Td>
    </Tr>
  )
}

function AddUser({ roles, onClose }: { roles: RbacRole[]; onClose: () => void }) {
  const create = useCreateUser()
  const error = create.error ? toApiError(create.error) : null
  const err = (k: string) =>
    error?.code === 'VALIDATION_ERROR' ? error.fields[k]?.[0] : undefined
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    create.mutate(
      {
        name: String(f.get('name') ?? '').trim(),
        email: String(f.get('email') ?? '').trim(),
        role_code: String(f.get('role_code') ?? ''),
      },
      {
        onSuccess: (u) => {
          toast.success(`${u.name} ditambahkan`)
          onClose()
        },
      },
    )
  }
  return (
    <Modal
      open
      onOpenChange={(o) => !o && !create.isPending && onClose()}
      title="Tambah pengguna"
      description="Pengguna baru langsung aktif dengan peran yang dipilih."
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nama" name="name" required autoFocus error={err('name')} />
        <Field label="Email" name="email" type="email" required error={err('email')} />
        <SelectField
          label="Peran"
          name="role_code"
          required
          defaultValue="user"
          error={err('role_code')}
        >
          {roles.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </SelectField>
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
            {create.isPending ? 'Menyimpan…' : 'Tambah'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
