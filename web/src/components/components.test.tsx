import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api/client'
import { describeError } from '../lib/errors'
import { JsonView } from './JsonView'
import { ConsoleStatusDot, LevelBadge, OrderStatusDot, TxStateBadge } from './StatusDot'

describe('status markers', () => {
  it('always pair the dot with a word', () => {
    render(
      <>
        <ConsoleStatusDot status="down" />
        <TxStateBadge state="needs_attention" />
        <OrderStatusDot status="ANTRE" />
        <LevelBadge level="warn" />
      </>,
    )
    for (const word of ['Mati', 'Perlu tindakan', 'Antre', 'Warn'])
      expect(screen.getByText(word)).toBeInTheDocument()
  })
})

describe('describeError', () => {
  it.each([
    ['CONSOLE_UNREACHABLE', 502, 'Console tidak dapat dihubungi', 'Layanan sedang bermasalah'],
    ['CONSOLE_TIMEOUT', 504, 'Console tidak merespons', 'Layanan sedang bermasalah'],
    ['TRANSACTION_REFUSED', 409, 'Transaksi ditolak', 'Tidak dapat disimpan'],
    ['VERSION_CONFLICT', 409, 'Data baru saja diubah', 'Data baru saja diubah'],
    ['FORBIDDEN', 403, 'Tidak punya izin', 'Anda tidak punya akses'],
    ['NETWORK', 0, 'Tidak dapat terhubung ke portal', 'Tidak dapat terhubung ke portal'],
  ] as const)('%s: technical vs plain copy', (code, status, admin, user) => {
    const e = new ApiError(code, 'pesan', status)
    expect(describeError(e, true).title).toContain(admin)
    expect(describeError(e, false).title).toContain(user)
    // User copy never names a console or a code.
    expect(describeError(e, false).title + describeError(e, false).next).not.toMatch(
      /console|CONSOLE|HTTP|Gudang/,
    )
  })
})

describe('JsonView', () => {
  it('pretty-prints and copies', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard ?? {}, 'writeText')
    render(<JsonView value={{ sku: 'SKU-BB-001', qty: 3 }} label="Request" />)
    expect(screen.getByLabelText('Request', { selector: 'pre' })).toHaveTextContent(
      '"sku": "SKU-BB-001"',
    )
    await user.click(screen.getByRole('button', { name: 'Salin Request' }))
    expect(await navigator.clipboard.readText()).toContain('SKU-BB-001')
    expect(screen.getByText('Tersalin')).toBeInTheDocument()
  })
})
