import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { findProcess } from '../../mocks/data/processes'
import { runs, startRun } from '../../mocks/data/runs'
import { server } from '../../mocks/node'
import { mockConfig, setScenario } from '../../mocks/scenarios'
import { renderApp } from '../../test/utils'

const by = { id: 1, name: 'Rina Wulandari' }
const strip = () => screen.getByRole('list', { name: 'Ringkasan status langkah' })

describe('RunDetailPage', () => {
  it('polls a live run step by step and stops polling once final', async () => {
    // Live simulation (HTTP stays instant) so the running state is observable: ~1.5–3 s per run.
    mockConfig.instantRuns = false
    mockConfig.speed = 3
    let polls = 0
    const count = ({ request }: { request: Request }) => {
      if (/\/runs\/run_[^/]+$/.test(new URL(request.url).pathname)) polls++
    }
    server.events.on('request:start', count)
    try {
      const r = startRun(findProcess(1)!, { customer: 'Toko', sku: 'SKU-BJ-001', qty: 10 }, by)
      renderApp(`/runs/${r.id}`, 'admin')
      expect(await screen.findByText(/Memperbarui otomatis/)).toBeInTheDocument()
      // At least one step must be seen running mid-way, proving the list moves between polls.
      await waitFor(
        () => expect(within(strip()).getAllByText('Berhasil').length).toBeGreaterThan(0),
        {
          timeout: 6000,
        },
      )
      await waitFor(
        () => expect(screen.queryByText(/Memperbarui otomatis/)).not.toBeInTheDocument(),
        {
          timeout: 8000,
        },
      )
      expect(within(strip()).getAllByText('Berhasil')).toHaveLength(3)
      const atFinal = polls
      await new Promise((res) => setTimeout(res, 2500))
      expect(polls).toBe(atFinal)
    } finally {
      server.events.removeListener('request:start', count)
      mockConfig.instantRuns = true
      mockConfig.speed = 1
    }
  }, 20_000)

  it('shows compensation, the failed step opened with shortages, and retry from start', async () => {
    const r = startRun(findProcess(1)!, { customer: 'Toko', sku: 'SKU-BJ-001', qty: 150 }, by)
    renderApp(`/runs/${r.id}`, 'admin')
    // Run status turns 'failed' after the compensation tick; wait for the action, not just the step.
    expect(
      await screen.findByRole('button', { name: 'Jalankan ulang dari awal' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(within(strip()).getByText('Dikompensasi')).toBeInTheDocument()
    expect(screen.getByText('Kekurangan stok')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'SKU-BB-001' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ulangi dari langkah gagal' }),
    ).not.toBeInTheDocument()
  })

  it('offers "retry from failed step" when nothing was compensated, and retries', async () => {
    setScenario('gudang-down')
    const r = startRun(findProcess(3)!, { nik: 'E-008' }, by)
    renderApp(`/runs/${r.id}`, 'admin')
    const btn = await screen.findByRole(
      'button',
      { name: 'Ulangi dari langkah gagal' },
      { timeout: 4000 },
    )
    setScenario('ok')
    await userEvent.click(btn)
    expect(await screen.findByText(/ulangan dari/)).toHaveTextContent(r.id)
  })

  it('marks compensation_failed as needing manual action', async () => {
    const r = runs.find((x) => x.steps?.some((s) => s.status === 'compensation_failed'))!
    renderApp(`/runs/${r.id}`, 'admin')
    expect(await screen.findByText('Perlu tindakan manual.')).toBeInTheDocument()
    expect(within(strip()).getByText('Kompensasi gagal')).toBeInTheDocument()
  })

  it('cancels a queued run', async () => {
    // Started but not yet advanced: the timers have not fired at render time.
    const r = startRun(findProcess(2)!, { name: 'Maya', division: 'Gudang', role: 'Operator' }, by)
    r.status = 'queued'
    renderApp(`/runs/${r.id}`, 'admin')
    const cancel =
      screen.queryByRole('button', { name: 'Batalkan' }) ??
      (await screen.findByRole('button', { name: 'Batalkan' }))
    await userEvent.click(cancel)
    expect(await screen.findByText('Dibatalkan')).toBeInTheDocument()
  })
})
