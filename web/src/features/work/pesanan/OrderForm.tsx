import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, inputClass } from '../../../components/ui/Input'
import { Select, SelectField } from '../../../components/ui/Select'
import { rupiah } from '../../../lib/format'
import { FormSheet } from '../FormSheet'
import { fieldError, text } from '../form'
import { useOptions, workKeys } from '../queries'
import { useWrite } from '../useWrite'

type Line = { key: number; item_id: string; qty: string }
let lineSeq = 0
const newLine = (): Line => ({ key: ++lineSeq, item_id: '', qty: '' })

/** New order: customer, PIC, and lines of active finished goods. */
export function OrderForm({ onClose, onReload }: { onClose: () => void; onReload: () => void }) {
  const write = useWrite()
  const items = useOptions('items')
  const employees = useOptions('employees')
  const [lines, setLines] = useState<Line[]>(() => [newLine()])
  const err = (k: string) => fieldError(write.outcome, k)

  const sellable = (items.data ?? []).filter((i) => i.jenis === 'barang_jadi')
  const price = (id: string) => sellable.find((i) => i.id === id)?.harga_jual_idr ?? 0
  const total = lines.reduce((s, l) => s + price(l.item_id) * (Number(l.qty) || 0), 0)
  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const submit = (f: FormData) => {
    void write.run(
      {
        method: 'POST',
        url: '/orders',
        data: {
          customer: text(f, 'customer'),
          pic_employee_id: text(f, 'pic_employee_id'),
          lines: lines.map((l) => ({
            item_id: l.item_id,
            qty: l.qty.trim() === '' ? NaN : Number(l.qty),
          })),
        },
      },
      {
        success: 'Pesanan dibuat',
        // A new order reserves stock, so the item list changes too.
        invalidate: [workKeys.all('orders'), workKeys.all('items')],
        onDone: onClose,
      },
    )
  }

  return (
    <FormSheet
      open
      onClose={onClose}
      title="Buat pesanan"
      description="Stok barang langsung dipesan saat pesanan tersimpan."
      submitLabel="Buat pesanan"
      write={write}
      onSubmit={submit}
      onReload={onReload}
    >
      <Field label="Pelanggan" name="customer" required autoFocus error={err('customer')} />
      <SelectField
        label="Penanggung jawab"
        name="pic_employee_id"
        required
        defaultValue=""
        error={err('pic_employee_id')}
      >
        <option value="" disabled>
          {employees.isPending ? 'Memuat karyawan…' : 'Pilih penanggung jawab'}
        </option>
        {employees.data?.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </SelectField>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-dense font-semibold">
          Barang <span className="font-normal text-muted">(wajib, hanya barang jadi aktif)</span>
        </legend>
        {err('lines') ? <p className="text-xs text-error">{err('lines')}</p> : null}
        {lines.map((l, i) => {
          const itemErr = err(`lines.${i}.item_id`)
          const qtyErr = err(`lines.${i}.qty`)
          const stock = sellable.find((x) => x.id === l.item_id)
          return (
            <div key={l.key} className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                <label className="flex min-w-0 flex-1 flex-col">
                  <span className="sr-only">Barang baris {i + 1}</span>
                  <Select
                    value={l.item_id}
                    onChange={(e) => update(l.key, { item_id: e.target.value })}
                    aria-invalid={itemErr ? true : undefined}
                    className="w-full aria-[invalid=true]:border-error"
                  >
                    <option value="" disabled>
                      {items.isPending ? 'Memuat barang…' : 'Pilih barang'}
                    </option>
                    {sellable.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.nama} · {rupiah(it.harga_jual_idr ?? 0)}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex w-24 flex-col">
                  <span className="sr-only">Jumlah baris {i + 1}</span>
                  <input
                    inputMode="numeric"
                    placeholder="Jumlah"
                    value={l.qty}
                    onChange={(e) => update(l.key, { qty: e.target.value.replace(/\D/g, '') })}
                    aria-invalid={qtyErr ? true : undefined}
                    className={`${inputClass} w-full text-right`}
                  />
                </label>
                <Button
                  variant="ghost"
                  aria-label={`Hapus baris ${i + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                >
                  <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                </Button>
              </div>
              {itemErr || qtyErr ? (
                <p className="text-xs text-error">{itemErr ?? qtyErr}</p>
              ) : stock ? (
                <p className="text-xs text-muted">
                  Tersedia {stock.stok_tersedia} {stock.satuan}
                </p>
              ) : null}
            </div>
          )
        })}
        <div className="flex items-center justify-between gap-2">
          <Button onClick={() => setLines((ls) => [...ls, newLine()])}>
            <Plus size={16} strokeWidth={1.5} aria-hidden />
            Tambah baris
          </Button>
          <span className="text-dense">
            Total <span className="font-semibold tabular-nums">{rupiah(total)}</span>
          </span>
        </div>
      </fieldset>
    </FormSheet>
  )
}
