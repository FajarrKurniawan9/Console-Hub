import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api/client'
import { describeError } from '../lib/errors'
import { JsonView } from './JsonView'
import { ActiveStatusDot, ConsoleStatusDot, LevelBadge } from './StatusDot'

describe('status markers', () => {
  it('always pair the dot with a word', () => {
    render(
      <>
        <ConsoleStatusDot status="down" />
        <ActiveStatusDot status="nonaktif" />
        <LevelBadge level="warn" />
      </>,
    )
    for (const word of ['Mati', 'Nonaktif', 'Warn'])
      expect(screen.getByText(word)).toBeInTheDocument()
  })
})

describe('describeError', () => {
  it.each([
    ['SOURCE_UNREACHABLE', 502, 'API sumber tidak dapat dihubungi', 'Layanan sedang bermasalah'],
    ['SOURCE_TIMEOUT', 504, 'API sumber tidak merespons', 'Layanan sedang bermasalah'],
    ['REFERENCED', 409, 'Masih dipakai data lain', 'Belum bisa dinonaktifkan'],
    ['VERSION_CONFLICT', 409, 'Data baru saja diubah', 'Data baru saja diubah'],
    ['FORBIDDEN', 403, 'Tidak punya izin', 'Anda tidak punya akses'],
    ['NETWORK', 0, 'Tidak dapat terhubung ke portal', 'Tidak dapat terhubung ke portal'],
  ] as const)('%s: technical vs plain copy', (code, status, admin, user) => {
    const e = new ApiError(code, 'pesan', status)
    expect(describeError(e, true).title).toContain(admin)
    expect(describeError(e, false).title).toContain(user)
    // User copy never names a source or a code.
    expect(describeError(e, false).title + describeError(e, false).next).not.toMatch(
      /console|API|SOURCE|HTTP|Gudang/,
    )
  })
})

describe('JsonView', () => {
  it('pretty-prints and copies', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard ?? {}, 'writeText')
    render(<JsonView value={{ name: 'Kain katun', quantity: 3 }} label="Request" />)
    expect(screen.getByLabelText('Request', { selector: 'pre' })).toHaveTextContent(
      '"name": "Kain katun"',
    )
    await user.click(screen.getByRole('button', { name: 'Salin Request' }))
    expect(await navigator.clipboard.readText()).toContain('Kain katun')
    expect(screen.getByText('Tersalin')).toBeInTheDocument()
  })
})
