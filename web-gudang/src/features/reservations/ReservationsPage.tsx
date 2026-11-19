import { useState } from 'react'
import { ListFrame } from '../../components/ListFrame'
import { StatusDot } from '../../components/StatusDot'
import { FilterSelect, SearchBox, Toolbar } from '../../components/Toolbar'
import { Notice, Panel, Topbar } from '../../components/Topbar'
import { Table, Td, Th } from '../../components/ui/Table'
import { useReservations } from '../../lib/api/hooks'
import { formatDateTime, formatNumber } from '../../lib/format'
import { RESERVATION } from '../../lib/labels'
import { useDebounced } from '../../lib/useDebounced'
import { useUrlState } from '../../lib/useUrlState'

export function ReservationsPage() {
  const [f, set] = useUrlState(['q', 'status'] as const)
  const [search, setSearch] = useState(f.q)
  const q = useDebounced(search)
  const list = useReservations({ q, status: f.status })

  return (
    <>
      <Topbar title="Reservasi" />
      <div className="flex flex-col gap-3 p-6">
        <Notice>Reservasi dibuat dan dilepas otomatis oleh pesanan dari Console Hub.</Notice>
        <Panel>
          <Toolbar>
            <SearchBox
              label="Cari reservasi"
              placeholder="Cari kode pesanan atau barang"
              value={search}
              onChange={(v) => {
                setSearch(v)
                set('q', v)
              }}
            />
            <FilterSelect
              label="Status"
              value={f.status}
              onChange={(v) => set('status', v)}
              options={[
                ['', 'Semua'],
                ['aktif', 'Aktif'],
                ['dilepas', 'Dilepas'],
                ['dipakai', 'Dipakai'],
              ]}
            />
          </Toolbar>
          <ListFrame
            query={list}
            label="reservasi"
            empty={q || f.status ? 'Tidak ada reservasi yang cocok dengan filter.' : 'Belum ada reservasi.'}
          >
            <Table>
              <thead>
                <tr>
                  <Th>Pesanan</Th>
                  <Th>Barang</Th>
                  <Th num>Jumlah</Th>
                  <Th>Status</Th>
                  <Th>Dibuat</Th>
                  <Th>Ditutup</Th>
                </tr>
              </thead>
              <tbody>
                {list.rows?.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-mono text-[13px]">{r.order_code}</Td>
                    <Td>
                      <span className="font-mono text-[13px]">{r.sku}</span>{' '}
                      <span className="text-muted">{r.item_name}</span>
                    </Td>
                    <Td num>{formatNumber(r.quantity)}</Td>
                    <Td>
                      <StatusDot {...RESERVATION[r.status]} />
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(r.closed_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </ListFrame>
        </Panel>
      </div>
    </>
  )
}
