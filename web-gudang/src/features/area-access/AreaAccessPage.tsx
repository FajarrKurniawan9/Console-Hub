import { useId, useState } from 'react'
import { ListFrame } from '../../components/ListFrame'
import { StatusDot } from '../../components/StatusDot'
import { SearchBox, Toolbar } from '../../components/Toolbar'
import { Notice, Panel, Topbar } from '../../components/Topbar'
import { Table, Td, Th } from '../../components/ui/Table'
import { useAreaAccess } from '../../lib/api/hooks'
import { formatDateTime } from '../../lib/format'
import { useDebounced } from '../../lib/useDebounced'
import { useUrlState } from '../../lib/useUrlState'

export function AreaAccessPage() {
  const [f, set] = useUrlState(['q', 'active'] as const)
  const [search, setSearch] = useState(f.q)
  const q = useDebounced(search)
  const list = useAreaAccess({ q, active: f.active === 'true' ? 'true' : undefined })
  const switchId = useId()

  return (
    <>
      <Topbar title="Akses area" />
      <div className="flex flex-col gap-3 p-6">
        <Notice>Akses area diberikan dan dicabut dari Console Hub.</Notice>
        <Panel>
          <Toolbar>
            <SearchBox
              label="Cari akses area"
              placeholder="Cari NIK, nama, atau area"
              value={search}
              onChange={(v) => {
                setSearch(v)
                set('q', v)
              }}
            />
            <label htmlFor={switchId} className="flex h-8 items-center gap-2">
              <input
                id={switchId}
                type="checkbox"
                role="switch"
                checked={f.active === 'true'}
                onChange={(e) => set('active', e.target.checked ? 'true' : '')}
                className="size-4 accent-accent"
              />
              Hanya yang aktif
            </label>
          </Toolbar>
          <ListFrame
            query={list}
            label="akses area"
            empty={q || f.active ? 'Tidak ada akses yang cocok dengan filter.' : 'Belum ada akses area.'}
          >
            <Table>
              <thead>
                <tr>
                  <Th>NIK</Th>
                  <Th>Nama</Th>
                  <Th>Area</Th>
                  <Th>Diberikan</Th>
                  <Th>Dicabut</Th>
                </tr>
              </thead>
              <tbody>
                {list.rows?.map((a) => (
                  <tr key={`${a.employee_nik}-${a.area}-${a.granted_at}`}>
                    <Td className="font-mono text-[13px]">{a.employee_nik}</Td>
                    <Td>{a.employee_name}</Td>
                    <Td>{a.area}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(a.granted_at)}</Td>
                    <Td className="whitespace-nowrap">
                      {a.revoked_at ? (
                        <span className="text-muted">{formatDateTime(a.revoked_at)}</span>
                      ) : (
                        <StatusDot tone="ok" label="Masih aktif" />
                      )}
                    </Td>
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
