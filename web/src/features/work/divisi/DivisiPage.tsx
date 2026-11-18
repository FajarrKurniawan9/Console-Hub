import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ActiveStatusDot } from '../../../components/StatusDot'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Input'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import type { Division } from '../../../lib/api/schemas'
import { useCan, useIsAdminView } from '../../../lib/permissions'
import { useUrlState } from '../../../lib/useUrlState'
import { FormSheet } from '../FormSheet'
import { changed, fieldError, text } from '../form'
import { ListFrame } from '../ListFrame'
import { useWorkList, workKeys } from '../queries'
import { RowActions } from '../RowActions'
import { ACTIVE_FILTER } from '../labels'
import { useDeactivate } from '../useDeactivate'
import { useWrite } from '../useWrite'
import { VerifyPanel } from '../VerifyPanel'

export function DivisiPage() {
  const url = useUrlState()
  const qc = useQueryClient()
  const can = useCan()
  const admin = useIsAdminView()
  const list = useWorkList('divisions', url.get('q'), url.get('status'))
  const [editing, setEditing] = useState<Division | 'new' | null>(null)
  const [viewing, setViewing] = useState<Division | null>(null)
  const reload = () => void qc.invalidateQueries({ queryKey: workKeys.all('divisions') })
  const deactivate = useDeactivate('divisions', 'divisi', reload)

  const actions = (d: Division) => (
    <RowActions
      name={d.nama}
      inactive={d.status === 'nonaktif'}
      canEdit={can('divisi.update')}
      canDeactivate={can('divisi.delete')}
      onEdit={() => setEditing(d)}
      onDeactivate={() =>
        deactivate.ask({ id: d.id, label: `Divisi ${d.nama}`, version: d.version })
      }
    />
  )

  return (
    <>
      <ListFrame
        title="Divisi"
        noun="divisi"
        url={url}
        statuses={ACTIVE_FILTER}
        query={list}
        primary={
          can('divisi.create') ? (
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus size={16} strokeWidth={1.5} aria-hidden />
              Tambah divisi
            </Button>
          ) : null
        }
        emptyMessage="Belum ada divisi. Divisi dibutuhkan sebelum menambahkan karyawan."
      >
        {(rows) =>
          admin ? (
            <Table>
              <thead>
                <tr>
                  <Th>Kode</Th>
                  <Th>Nama</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Versi</Th>
                  <Th>
                    <span className="sr-only">Aksi</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <Tr
                    key={d.id}
                    tabIndex={0}
                    aria-label={`Detail divisi ${d.nama}`}
                    onClick={() => setViewing(d)}
                    onKeyDown={(k) =>
                      k.key === 'Enter' && k.target === k.currentTarget && setViewing(d)
                    }
                    className={`cursor-pointer hover:bg-surface ${d.status === 'nonaktif' ? 'text-muted' : ''}`}
                  >
                    <Td className="font-mono">{d.kode}</Td>
                    <Td className="font-semibold">{d.nama}</Td>
                    <Td>
                      <ActiveStatusDot status={d.status} />
                    </Td>
                    <Td className="text-right font-mono">{d.version}</Td>
                    <Td onClick={(x) => x.stopPropagation()}>{actions(d)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y">
              {rows.map((d) => (
                <li
                  key={d.id}
                  className={`flex items-center gap-4 px-4 py-3 ${d.status === 'nonaktif' ? 'text-muted' : ''}`}
                >
                  <span className="flex-1 font-semibold">{d.nama}</span>
                  {d.status === 'nonaktif' ? <ActiveStatusDot status="nonaktif" /> : null}
                  {actions(d)}
                </li>
              ))}
            </ul>
          )
        }
      </ListFrame>
      {editing ? (
        <DivisionForm
          division={editing === 'new' ? null : editing}
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
          resource="divisions"
          id={viewing?.id ?? null}
          title={viewing ? `Divisi ${viewing.nama}` : ''}
          fields={
            viewing
              ? [
                  ['Kode', <span className="font-mono">{viewing.kode}</span>],
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

function DivisionForm({
  division,
  onClose,
  onReload,
}: {
  division: Division | null
  onClose: () => void
  onReload: () => void
}) {
  const write = useWrite()
  const err = (k: string) => fieldError(write.outcome, k)
  const submit = (f: FormData) => {
    const values = { kode: text(f, 'kode').toUpperCase(), nama: text(f, 'nama') }
    const opts = {
      success: `Divisi ${values.nama} disimpan`,
      // Employee rows show the division name, so refresh them too.
      invalidate: [workKeys.all('divisions'), workKeys.all('employees')],
      onDone: onClose,
    }
    if (!division) return void write.run({ method: 'POST', url: '/divisions', data: values }, opts)
    const diff = changed({ kode: division.kode, nama: division.nama }, values)
    if (!Object.keys(diff).length) return onClose()
    void write.run(
      {
        method: 'PATCH',
        url: `/divisions/${division.id}`,
        data: { ...diff, expected_version: division.version },
      },
      opts,
    )
  }
  return (
    <FormSheet
      open
      onClose={onClose}
      title={division ? `Ubah divisi ${division.nama}` : 'Tambah divisi'}
      submitLabel="Simpan"
      write={write}
      onSubmit={submit}
      onReload={onReload}
    >
      <Field
        label="Kode"
        name="kode"
        required
        autoFocus
        maxLength={5}
        defaultValue={division?.kode}
        hint="2 sampai 5 huruf, mis. HRD."
        error={err('kode')}
        className="max-w-40"
      />
      <Field label="Nama" name="nama" required defaultValue={division?.nama} error={err('nama')} />
    </FormSheet>
  )
}
