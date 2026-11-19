import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Table, Td, Th, Tr } from '../../components/ui/Table'

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

/**
 * Work-data table for both shells (Admin 13px dense, User 15px roomy via data-shell).
 * A row opens its drawer with click or Enter; inactive rows are dimmed.
 */
export function RowsTable<T extends { id: string; status: string }>({
  rows,
  columns,
  label,
  onOpen,
  actions,
}: {
  rows: T[]
  columns: Column<T>[]
  /** Accessible name of a row, e.g. "Detail Kain katun". */
  label: (row: T) => string
  onOpen: (row: T) => void
  actions?: (row: T) => ReactNode
}) {
  return (
    <Table>
      <thead>
        <tr>
          {columns.map((c) => (
            <Th key={c.header} className={c.className}>
              {c.header}
            </Th>
          ))}
          {actions ? (
            <Th>
              <span className="sr-only">Aksi</span>
            </Th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr
            key={r.id}
            tabIndex={0}
            aria-label={label(r)}
            onClick={() => onOpen(r)}
            onKeyDown={(k) => k.key === 'Enter' && k.target === k.currentTarget && onOpen(r)}
            className={clsx(
              'cursor-pointer hover:bg-surface',
              r.status === 'nonaktif' && 'text-muted',
            )}
          >
            {columns.map((c) => (
              <Td key={c.header} className={c.className}>
                {c.cell(r)}
              </Td>
            ))}
            {actions ? <Td onClick={(x) => x.stopPropagation()}>{actions(r)}</Td> : null}
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}
