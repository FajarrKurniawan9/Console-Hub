import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ActiveStatusDot } from '../../../components/StatusDot'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Input'
import { SelectField } from '../../../components/ui/Select'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import type { Employee } from '../../../lib/api/schemas'
import { useCan, useIsAdminView } from '../../../lib/permissions'
import { useUrlState } from '../../../lib/useUrlState'
import { FormSheet } from '../FormSheet'
import { changed, fieldError, text } from '../form'
import { ListFrame } from '../ListFrame'
import { useOptions, useWorkList, workKeys } from '../queries'
import { RowActions } from '../RowActions'
import { ACTIVE_FILTER } from '../labels'
import { useDeactivate } from '../useDeactivate'
import { useWrite } from '../useWrite'
import { VerifyPanel } from '../VerifyPanel'

export function KaryawanPage() {
  const url = useUrlState()
  const qc = useQueryClient()
  const can = useCan()
  const admin = useIsAdminView()
  const list = useWorkList('employees', url.get('q'), url.get('status'))
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const [viewing, setViewing] = useState<Employee | null>(null)
  const reload = () => void qc.invalidateQueries({ queryKey: workKeys.all('employees') })
  const deactivate = useDeactivate('employees', 'karyawan', reload)

  const actions = (e: Employee) => (
    <RowActions
      name={e.name}
      inactive={e.status === 'nonaktif'}
      canEdit={can('karyawan.update')}
      canDeactivate={can('karyawan.delete')}
      onEdit={() => setEditing(e)}
      onDeactivate={() => deactivate.ask({ id: e.id, label: e.name, version: e.version })}
    />
  )

  return (
    <>
      <ListFrame
        title="Karyawan"
        noun="karyawan"
        url={url}
        statuses={ACTIVE_FILTER}
        query={list}
        primary={
          can('karyawan.create') ? (
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus size={16} strokeWidth={1.5} aria-hidden />
              Tambah karyawan
            </Button>
          ) : null
        }
        emptyMessage="Belum ada karyawan. Tambahkan karyawan pertama untuk mulai mencatat penanggung jawab pesanan dan barang."
      >
        {(rows) =>
          admin ? (
            <Table>
              <thead>
                <tr>
                  <Th>NIK</Th>
                  <Th>Nama</Th>
                  <Th>Divisi</Th>
                  <Th>Jabatan</Th>
                  <Th>Area / tim</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Versi</Th>
                  <Th>
                    <span className="sr-only">Aksi</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <Tr
                    key={e.id}
                    tabIndex={0}
                    aria-label={`Detail ${e.name}`}
                    onClick={() => setViewing(e)}
                    onKeyDown={(k) =>
                      k.key === 'Enter' && k.target === k.currentTarget && setViewing(e)
                    }
                    className={`cursor-pointer hover:bg-surface ${e.status === 'nonaktif' ? 'text-muted' : ''}`}
                  >
                    <Td className="font-mono">{e.nik}</Td>
                    <Td className="font-semibold">{e.name}</Td>
                    <Td>{e.division.nama}</Td>
                    <Td>{e.position ?? '—'}</Td>
                    <Td className="text-muted">{[...e.areas, ...e.teams].join(', ') || '—'}</Td>
                    <Td>
                      <ActiveStatusDot status={e.status} />
                    </Td>
                    <Td className="text-right font-mono">{e.version}</Td>
                    <Td onClick={(x) => x.stopPropagation()}>{actions(e)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y">
              {rows.map((e) => (
                <li
                  key={e.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${e.status === 'nonaktif' ? 'text-muted' : ''}`}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{e.name}</span>
                    <span className="text-dense text-muted">
                      {[e.position, e.division.nama].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {e.status === 'nonaktif' ? <ActiveStatusDot status="nonaktif" /> : null}
                  {actions(e)}
                </li>
              ))}
            </ul>
          )
        }
      </ListFrame>
      {editing ? (
        <EmployeeForm
          employee={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onReload={() => {
            setEditing(null)
            reload()
          }}
        />
      ) : null}
      {deactivate.dialog}
      {admin ? (
        <VerifyPanel
          resource="employees"
          id={viewing?.id ?? null}
          title={viewing ? `${viewing.nik} · ${viewing.name}` : ''}
          fields={
            viewing
              ? [
                  ['Divisi', viewing.division.nama],
                  ['Jabatan', viewing.position ?? '—'],
                  ['Area / tim', [...viewing.areas, ...viewing.teams].join(', ') || '—'],
                  ['Versi pemilik (HR)', <span className="font-mono">v{viewing.version}</span>],
                ]
              : []
          }
          onClose={() => setViewing(null)}
        />
      ) : null}
    </>
  )
}

function EmployeeForm({
  employee,
  onClose,
  onReload,
}: {
  employee: Employee | null
  onClose: () => void
  onReload: () => void
}) {
  const write = useWrite()
  const divisions = useOptions('divisions')
  const err = (k: string) => fieldError(write.outcome, k)

  const submit = (f: FormData) => {
    const values = {
      name: text(f, 'name'),
      division_id: text(f, 'division_id'),
      position: text(f, 'position'),
      area: text(f, 'area'),
      team: text(f, 'team'),
    }
    const opts = {
      success: employee ? `Data ${values.name} disimpan` : `${values.name} ditambahkan`,
      invalidate: [workKeys.all('employees')],
      onDone: onClose,
    }
    if (!employee) {
      void write.run({ method: 'POST', url: '/employees', data: values }, opts)
      return
    }
    const before = {
      name: employee.name,
      division_id: employee.division.id,
      position: employee.position ?? '',
      area: employee.areas[0] ?? '',
      team: employee.teams[0] ?? '',
    }
    const diff = changed(before, values)
    if (!Object.keys(diff).length) return onClose()
    void write.run(
      {
        method: 'PATCH',
        url: `/employees/${employee.id}`,
        data: { ...diff, expected_version: employee.version },
      },
      opts,
    )
  }

  return (
    <FormSheet
      open
      onClose={onClose}
      title={employee ? `Ubah ${employee.name}` : 'Tambah karyawan'}
      description={
        employee
          ? 'Perubahan disimpan ke semua bagian sistem sekaligus.'
          : 'Karyawan baru tercatat di semua bagian sistem sekaligus.'
      }
      submitLabel="Simpan"
      write={write}
      onSubmit={submit}
      onReload={onReload}
    >
      <Field
        label="Nama"
        name="name"
        required
        autoFocus
        defaultValue={employee?.name}
        error={err('name')}
      />
      <SelectField
        label="Divisi"
        name="division_id"
        required
        defaultValue={employee?.division.id ?? ''}
        error={err('division_id')}
        hint={
          divisions.isError ? 'Daftar divisi gagal dimuat. Tutup panel lalu coba lagi.' : undefined
        }
      >
        <option value="" disabled>
          {divisions.isPending ? 'Memuat divisi…' : 'Pilih divisi'}
        </option>
        {divisions.data?.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nama}
          </option>
        ))}
      </SelectField>
      <Field
        label="Jabatan"
        name="position"
        defaultValue={employee?.position ?? ''}
        error={err('position')}
      />
      <Field
        label="Area gudang"
        name="area"
        defaultValue={employee?.areas[0] ?? ''}
        hint="Opsional. Isi bila karyawan bertugas di area gudang tertentu, mis. Gudang A."
        error={err('area')}
      />
      <Field
        label="Tim"
        name="team"
        defaultValue={employee?.teams[0] ?? ''}
        hint="Opsional. Tim shift produksi, mis. Shift Pagi."
        error={err('team')}
      />
    </FormSheet>
  )
}
