import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import { ErrorState } from './ErrorState'
import { JsonView } from './JsonView'
import { ConsoleStatusDot, LevelBadge, RunStatusDot } from './StatusDot'
import { Providers } from '../app/providers'

describe('status markers', () => {
  it('always pair the dot with a word', () => {
    render(
      <>
        <ConsoleStatusDot status="down" />
        <RunStatusDot status="running" />
        <LevelBadge level="warn" />
      </>,
    )
    expect(screen.getByText('Mati')).toBeInTheDocument()
    expect(screen.getByText('Berjalan')).toBeInTheDocument()
    expect(screen.getByText('Warn')).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it.each([
    ['CONSOLE_TIMEOUT', 504, 'tidak merespons dalam batas waktu'],
    ['CONSOLE_UNREACHABLE', 503, 'tidak dapat dihubungi'],
    ['CONSOLE_ERROR', 502, 'mengembalikan error'],
    ['FORBIDDEN', 403, 'Tidak punya akses'],
    ['NOT_FOUND', 404, 'Data tidak ditemukan'],
    ['RATE_LIMITED', 429, 'Terlalu banyak permintaan'],
    ['NETWORK', 0, 'Tidak dapat terhubung ke portal'],
  ] as const)('%s says what failed and what to do', async (code, status, title) => {
    const retry = vi.fn()
    render(
      <Providers>
        <ErrorState
          error={new ApiError(code, 'pesan asli', status, { console: 'gudang' })}
          onRetry={retry}
        />
      </Providers>,
    )
    expect(await screen.findByText(new RegExp(title))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(code))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})

describe('JsonView', () => {
  it('pretty-prints and copies', async () => {
    const user = userEvent.setup()
    render(<JsonView value={{ sku: 'SKU-BB-001', qty: 3 }} label="Request" />)
    expect(screen.getByLabelText('Request', { selector: 'pre' })).toHaveTextContent(
      '"sku": "SKU-BB-001"',
    )
    await user.click(screen.getByRole('button', { name: 'Salin Request' }))
    expect(await navigator.clipboard.readText()).toContain('SKU-BB-001')
    expect(screen.getByText('Tersalin')).toBeInTheDocument()
  })
})
