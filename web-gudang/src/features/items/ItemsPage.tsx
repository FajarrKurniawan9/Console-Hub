import { useState } from 'react'
import { ListFrame } from '../../components/ListFrame'
import { StatusDot } from '../../components/StatusDot'
import { FilterSelect, SearchBox, Toolbar } from '../../components/Toolbar'
import { Notice, Panel, Topbar } from '../../components/Topbar'
import { Table, Td, Th, Tr } from '../../components/ui/Table'
import { useItems } from '../../lib/api/hooks'
import { formatNumber } from '../../lib/format'
import { KIND_LABEL, STOCK_LEVEL } from '../../lib/labels'
import { stockLevel } from '../../lib/stock'
import { useDebounced } from '../../lib/useDebounced'
import { useUrlState } from '../../lib/useUrlState'
import { ItemDrawer } from './ItemDrawer'

export function ItemsPage() {
  const [f, set] = useUrlState(['q', 'kind', 'stock'] as const)
  const [search, setSearch] = useState(f.q)
  const q = useDebounced(search)
  const items = useItems({ q, kind: f.kind, stock: f.stock })
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <>
      <Topbar title="Barang" />
      <div className="flex flex-col gap-3 p-6">
        <Notice>Data barang dikelola dari Console Hub dan tidak dapat diubah di sini.</Notice>
        <Panel>
          <Toolbar>
            <SearchBox
              label="Cari barang"
              placeholder="Cari SKU atau nama"
              value={search}
              onChange={(v) => {
                setSearch(v)
                set('q', v)
              }}
            />
            <FilterSelect
              label="Jenis"
              value={f.kind}
              onChange={(v) => set('kind', v)}
              options={[
                ['', 'Semua'],
                ['BB', KIND_LABEL.BB],
                ['BJ', KIND_LABEL.BJ],
              ]}
            />
            <FilterSelect
              label="Status stok"
              value={f.stock}
              onChange={(v) => set('stock', v)}
              options={[
                ['', 'Semua'],
                ['low', 'Menipis'],
                ['out', 'Habis'],
              ]}
            />
          </Toolbar>
          <ListFrame
            query={items}
            label="barang"
            empty={
              q || f.kind || f.stock
                ? 'Tidak ada barang yang cocok dengan pencarian atau filter.'
                : 'Belum ada barang dari Console Hub.'
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th>Nama</Th>
                  <Th>Jenis</Th>
                  <Th>Satuan</Th>
                  <Th num>Tersedia</Th>
                  <Th num>Direservasi</Th>
                  <Th num>Total</Th>
                  <Th>Status stok</Th>
                </tr>
              </thead>
              <tbody>
                {items.rows?.map((it) => (
                  <Tr key={it.id} onActivate={() => setOpenId(it.id)} aria-label={`${it.sku} ${it.name}, buka detail`}>
                    <Td className="font-mono text-[13px]">{it.sku}</Td>
                    <Td>{it.name}</Td>
                    <Td>{KIND_LABEL[it.kind]}</Td>
                    <Td>{it.unit}</Td>
                    <Td num>{formatNumber(it.stock.available)}</Td>
                    <Td num>{formatNumber(it.stock.reserved)}</Td>
                    <Td num>{formatNumber(it.stock.on_hand)}</Td>
                    <Td>
                      <span className="flex gap-3">
                        <StatusDot {...STOCK_LEVEL[stockLevel(it.stock.available, it.min_stock)]} />
                        {it.locked ? <StatusDot tone="warn" label="Ditahan" /> : null}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </ListFrame>
        </Panel>
      </div>
      <ItemDrawer itemId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
