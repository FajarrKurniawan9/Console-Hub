import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ActiveStatusDot } from '../../../components/StatusDot'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Input'
import { SelectField } from '../../../components/ui/Select'
import { Table, Td, Th, Tr } from '../../../components/ui/Table'
import type { Item } from '../../../lib/api/schemas'
import { number, rupiah } from '../../../lib/format'
import { useCan, useIsAdminView } from '../../../lib/permissions'
import { useUrlState } from '../../../lib/useUrlState'
import { FormSheet } from '../FormSheet'
import { changed, fieldError, numeric, text } from '../form'
import { ListFrame } from '../ListFrame'
import { useOptions, useWorkList, workKeys } from '../queries'
import { RowActions } from '../RowActions'
import { ACTIVE_FILTER } from '../labels'
import { useDeactivate } from '../useDeactivate'
import { useWrite } from '../useWrite'
import { JENIS } from '../labels'

function Stock({ item }: { item: Item }) {
  const low = item.status === 'aktif' && item.stok_tersedia < item.min_stock
  return (
    <span className={low ? 'font-semibold text-warn' : undefined}>
      {number(item.stok_tersedia)} {item.satuan}
      {low ? <span className="font-normal"> · di bawah minimum</span> : null}
    </span>
  )
}

export function BarangPage() {
  const url = useUrlState()
  const qc = useQueryClient()
  const can = useCan()
  const admin = useIsAdminView()
  const list = useWorkList('items', url.get('q'), url.get('status'))
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const reload = () => void qc.invalidateQueries({ queryKey: workKeys.all('items') })
  const deactivate = useDeactivate('items', 'barang', reload)

  const actions = (i: Item) => (
    <RowActions
      name={i.nama}
      inactive={i.status === 'nonaktif'}
      canEdit={can('barang.update')}
      canDeactivate={can('barang.delete')}
      onEdit={() => setEditing(i)}
      onDeactivate={() => deactivate.ask({ id: i.id, label: i.nama, version: i.version })}
    />
  )

  return (
    <>
      <ListFrame
        title="Barang"
        noun="barang"
        url={url}
        statuses={ACTIVE_FILTER}
        query={list}
        primary={
          can('barang.create') ? (
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus size={16} strokeWidth={1.5} aria-hidden />
              Tambah barang
            </Button>
          ) : null
        }
        emptyMessage="Belum ada barang. Tambahkan bahan baku atau barang jadi untuk mulai mencatat stok."
      >
        {(rows) =>
          admin ? (
            <Table>
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th>Nama</Th>
                  <Th>Jenis</Th>
                  <Th className="text-right">Stok tersedia</Th>
                  <Th className="text-right">Min.</Th>
                  <Th className="text-right">Harga jual</Th>
                  <Th>Penanggung jawab</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Versi</Th>
                  <Th>
                    <span className="sr-only">Aksi</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <Tr key={i.id} className={i.status === 'nonaktif' ? 'opacity-60' : ''}>
                    <Td className="font-mono">{i.sku}</Td>
                    <Td className="font-semibold">{i.nama}</Td>
                    <Td>{JENIS[i.jenis]}</Td>
                    <Td className="text-right">
                      <Stock item={i} />
                    </Td>
                    <Td className="text-right text-muted">{number(i.min_stock)}</Td>
                    <Td className="text-right">
                      {i.harga_jual_idr !== null ? rupiah(i.harga_jual_idr) : '—'}
                    </Td>
                    <Td>{i.pic?.name ?? <span className="text-muted">—</span>}</Td>
                    <Td>
                      <ActiveStatusDot status={i.status} />
                    </Td>
                    <Td className="text-right font-mono">{i.version}</Td>
                    <Td>{actions(i)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className="divide-y">
              {rows.map((i) => (
                <li
                  key={i.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${i.status === 'nonaktif' ? 'opacity-60' : ''}`}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{i.nama}</span>
                    <span className="text-dense text-muted">
                      {JENIS[i.jenis]}
                      {i.harga_jual_idr !== null ? ` · ${rupiah(i.harga_jual_idr)}` : ''}
                    </span>
                  </div>
                  <span className="text-dense">
                    <Stock item={i} />
                  </span>
                  {i.status === 'nonaktif' ? <ActiveStatusDot status="nonaktif" /> : null}
                  {actions(i)}
                </li>
              ))}
            </ul>
          )
        }
      </ListFrame>
      {editing ? (
        <ItemForm
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onReload={() => {
            setEditing(null)
            reload()
          }}
        />
      ) : null}
      {deactivate.dialog}
    </>
  )
}

function ItemForm({
  item,
  onClose,
  onReload,
}: {
  item: Item | null
  onClose: () => void
  onReload: () => void
}) {
  const write = useWrite()
  const employees = useOptions('employees')
  const [jenis, setJenis] = useState<Item['jenis'] | ''>(item?.jenis ?? '')
  const err = (k: string) => fieldError(write.outcome, k)

  const submit = (f: FormData) => {
    const values = {
      nama: text(f, 'nama'),
      jenis: text(f, 'jenis'),
      satuan: text(f, 'satuan'),
      min_stock: numeric(f, 'min_stock'),
      ...(jenis === 'barang_jadi' ? { harga_jual_idr: numeric(f, 'harga_jual_idr') } : {}),
      pic_employee_id: text(f, 'pic_employee_id') || null,
    }
    const opts = {
      success: `${values.nama} disimpan`,
      invalidate: [workKeys.all('items')],
      onDone: onClose,
    }
    if (!item) return void write.run({ method: 'POST', url: '/items', data: values }, opts)
    // Jenis cannot change after creation (the SKU prefix depends on it).
    const { jenis: _jenis, ...editable } = values
    const before = {
      nama: item.nama,
      satuan: item.satuan,
      min_stock: item.min_stock,
      harga_jual_idr: item.harga_jual_idr,
      pic_employee_id: item.pic?.id ?? null,
    }
    const diff = changed(before, editable)
    if (!Object.keys(diff).length) return onClose()
    void write.run(
      {
        method: 'PATCH',
        url: `/items/${item.id}`,
        data: { ...diff, expected_version: item.version },
      },
      opts,
    )
  }

  return (
    <FormSheet
      open
      onClose={onClose}
      title={item ? `Ubah ${item.nama}` : 'Tambah barang'}
      description={item ? `SKU ${item.sku}` : 'SKU dibuat otomatis sesuai jenis barang.'}
      submitLabel="Simpan"
      write={write}
      onSubmit={submit}
      onReload={onReload}
    >
      <Field
        label="Nama"
        name="nama"
        required
        autoFocus
        defaultValue={item?.nama}
        error={err('nama')}
      />
      <SelectField
        label="Jenis"
        name="jenis"
        required
        value={jenis}
        onChange={(e) => setJenis(e.target.value as Item['jenis'])}
        disabled={!!item}
        hint={item ? 'Jenis tidak dapat diubah setelah barang dibuat.' : undefined}
        error={err('jenis')}
      >
        <option value="" disabled>
          Pilih jenis
        </option>
        <option value="bahan_baku">Bahan baku</option>
        <option value="barang_jadi">Barang jadi</option>
      </SelectField>
      {item ? <input type="hidden" name="jenis" value={item.jenis} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Satuan"
          name="satuan"
          required
          defaultValue={item?.satuan}
          hint="mis. karung, pak, dus"
          error={err('satuan')}
        />
        <Field
          label="Stok minimum"
          name="min_stock"
          required
          inputMode="numeric"
          defaultValue={item?.min_stock}
          error={err('min_stock')}
        />
      </div>
      {jenis === 'barang_jadi' ? (
        <Field
          label="Harga jual (Rp)"
          name="harga_jual_idr"
          required
          inputMode="numeric"
          defaultValue={item?.harga_jual_idr ?? ''}
          hint="Dibulatkan ke ratusan rupiah, mis. 18500."
          error={err('harga_jual_idr')}
        />
      ) : null}
      <SelectField
        label="Penanggung jawab"
        name="pic_employee_id"
        defaultValue={item?.pic?.id ?? ''}
        error={err('pic_employee_id')}
      >
        <option value="">Belum ada</option>
        {employees.data?.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </SelectField>
    </FormSheet>
  )
}
