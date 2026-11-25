import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { calls, fail, ok, on, page, sources, users } from '../../test/api'
import { audit, log, rbacUsers, roles } from '../../test/admin'
import { renderApp } from '../../test/utils'

const section = async (name: string) =>
  (await screen.findByRole('heading', { name })).closest('section')!

describe('Ringkasan', () => {
  const overview = (down: string[] = []) =>
    ok({ sources: sources(down), log_errors_24h: 3, recent_audit: [audit(1, 'item.created')] })

  it('three source cards, error logs and recent activity', async () => {
    renderApp('/', 'admin')
    on('GET /admin/overview', overview())
    const cards = await within(await section('Sumber data')).findAllByRole('link', {
      name: /HR|Gudang|Produksi/,
    })
    expect(cards).toHaveLength(3)
    for (const c of cards) expect(c).toHaveTextContent('Normal')
    expect(screen.getByText(/log error dalam 24 jam terakhir/)).toBeInTheDocument()
    expect(within(await section('Aktivitas terbaru')).getAllByRole('listitem')).toHaveLength(1)
  })

  it('puts a dead source first', async () => {
    renderApp('/', 'admin')
    on('GET /admin/overview', overview(['gudang']))
    const cards = await within(await section('Sumber data')).findAllByRole('link', {
      name: /HR|Gudang|Produksi/,
    })
    expect(cards[0]).toHaveTextContent('Gudang')
    expect(cards[0]).toHaveTextContent('Mati')
  })

  it('empty: a specific sentence for activity', async () => {
    renderApp('/', 'admin')
    on('GET /admin/overview', ok({ sources: sources(), log_errors_24h: 0, recent_audit: [] }))
    expect(await screen.findByText(/Belum ada aktivitas/)).toBeInTheDocument()
  })
})

describe('Log gabungan', () => {
  it('lists logs, sends the level filter, opens raw data', async () => {
    renderApp('/log?level=error', 'admin')
    on('GET /admin/logs', page([log(2, 'error'), log(1, 'error', 'gudang')]))
    on('GET /admin/logs/2', ok(log(2, 'error')))
    const rows = await screen.findAllByRole('row', { name: /Buka log/ })
    expect(rows).toHaveLength(2)
    expect(calls.find((c) => c.url === '/admin/logs')!.params.get('level')).toBe('error')
    await userEvent.click(rows[0]!)
    expect(
      await within(await screen.findByRole('dialog')).findByText(/Data mentah dari/),
    ).toBeInTheDocument()
  })

  it('empty filter result offers to clear it', async () => {
    renderApp('/log?q=zzz', 'admin')
    on('GET /admin/logs', (c) => page(c.params.get('q') ? [] : [log(1, 'info')]))
    expect(await screen.findByText('Tidak ada log yang cocok dengan filter.')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /Hapus filter/ }).at(-1)!)
    expect(await screen.findAllByRole('row', { name: /Buka log/ })).toHaveLength(1)
  })

  it('warns a dead source may lag, and reports per-source pull results', async () => {
    renderApp('/log', 'admin')
    on('GET /admin/consoles', page(sources(['gudang'])))
    on('GET /admin/logs', page([log(1, 'info')]))
    on(
      'POST /admin/logs/sync',
      ok(
        [
          { console: { slug: 'hr', name: 'HR' }, status: 'ok', inserted: 4, error: null },
          {
            console: { slug: 'gudang', name: 'Gudang' },
            status: 'failed',
            inserted: null,
            error: 'Tidak dapat dihubungi.',
          },
          {
            console: { slug: 'produksi', name: 'Produksi' },
            status: 'ok',
            inserted: 0,
            error: null,
          },
        ],
        202,
      ),
    )
    expect(await screen.findByText(/mungkin tertinggal/)).toHaveTextContent('Gudang')
    await userEvent.click(screen.getByRole('button', { name: /Tarik sekarang/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Semua console' }))
    const box = (await screen.findByText('Hasil tarik log')).closest('[role=status]') as HTMLElement
    expect(within(box).getByText(/gagal\. Tidak dapat dihubungi/)).toBeInTheDocument()
    expect(within(box).getAllByText(/berhasil/)).toHaveLength(2)
  })

  it('does not falsely show "log baru" when higher DB IDs sit below rows[0]', async () => {
    renderApp('/log', 'admin')
    on('GET /admin/consoles', page(sources()))
    on(
      'GET /admin/logs',
      page([
        { ...log(9, 'info', 'produksi'), occurred_at: '2026-11-19T05:00:00Z' },
        { ...log(16, 'info', 'hr'), occurred_at: '2026-11-19T04:00:00Z' },
        { ...log(20, 'warn', 'gudang'), occurred_at: '2026-11-19T03:00:00Z' },
      ]),
    )

    expect(await screen.findAllByRole('row', { name: /Buka log/ })).toHaveLength(3)
    await waitFor(() => {
      expect(calls.filter((c) => c.url === '/admin/logs').length).toBeGreaterThanOrEqual(2)
    })
    expect(screen.queryByRole('button', { name: /log baru/i })).not.toBeInTheDocument()
  })

  it('shows "N log baru" after new logs arrive, reloads rows on click, and hides the button', async () => {
    let currentLogs = [{ ...log(9, 'info', 'produksi'), occurred_at: '2026-11-19T05:00:00Z' }]
    renderApp('/log', 'admin')
    on('GET /admin/consoles', page(sources()))
    on('GET /admin/logs', () => page(currentLogs))
    on('POST /admin/logs/sync', () => {
      currentLogs = [
        { ...log(10, 'warn', 'hr'), occurred_at: '2026-11-19T06:00:00Z' },
        { ...log(9, 'info', 'produksi'), occurred_at: '2026-11-19T05:00:00Z' },
        { ...log(11, 'error', 'gudang'), occurred_at: '2026-11-19T04:00:00Z' },
      ]
      return ok([{ console: { slug: 'hr', name: 'HR' }, status: 'ok', inserted: 2, error: null }], 202)
    })

    expect(await screen.findAllByRole('row', { name: /Buka log/ })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /Tarik sekarang/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Semua console' }))

    const newBtn = await screen.findByRole('button', { name: /2 log baru/i })
    await userEvent.click(newBtn)

    await waitFor(() => {
      expect(screen.getAllByRole('row', { name: /Buka log/ })).toHaveLength(3)
      expect(screen.queryByRole('button', { name: /log baru/i })).not.toBeInTheDocument()
    })
  })
})

describe('Audit', () => {
  it('sends the action filter and shows old → new', async () => {
    renderApp('/audit?action=item.updated', 'admin')
    on('GET /admin/rbac/users', page(rbacUsers))
    on(
      'GET /admin/audit',
      page([audit(5, 'item.updated', { changes: { quantity: { old: 10, new: 12 } } })]),
    )
    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(rows[0]).toHaveTextContent(/quantity: 10 → 12/)
    expect(calls.find((c) => c.url === '/admin/audit')!.params.get('action')).toBe('item.updated')
  })

  it('is 403 for User, and never asks the hub', async () => {
    renderApp('/audit', 'user')
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
    expect(calls.some((c) => c.url === '/admin/audit')).toBe(false)
  })
})

describe('Sumber data', () => {
  it('tests the connection and shows the result in place', async () => {
    renderApp('/console/1', 'admin')
    on('GET /admin/consoles/1', ok(sources()[0]))
    on(
      'POST /admin/consoles/1/test',
      ok({ status: 'ok', latency_ms: 90, message: 'HR sehat (90 ms).' }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Uji koneksi' }))
    expect(await screen.findByText(/Hasil uji: Normal/)).toBeInTheDocument()
  })

  it('explains a dead source and never shows credentials', async () => {
    renderApp('/console/2', 'admin')
    on('GET /admin/consoles/2', ok(sources(['gudang'])[1]))
    on(
      'POST /admin/consoles/2/test',
      ok({ status: 'down', latency_ms: null, message: 'Gudang tidak dapat dihubungi.' }),
    )
    expect(await screen.findByText(/Tidak dapat dihubungi sejak/)).toBeInTheDocument()
    expect(screen.queryByText(/kredensial|password|api_key|service_key/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Uji koneksi' }))
    expect(await screen.findByText(/Hasil uji: Mati/)).toBeInTheDocument()
  })
})

describe('Pengguna & izin', () => {
  const rbac = () => {
    on('GET /admin/rbac/users', page(rbacUsers))
    on('GET /admin/rbac/roles', page(roles()))
    on('GET /admin/rbac/permissions', page(users.admin.permissions))
  }

  it('lists users and shows a duplicate email under the field', async () => {
    renderApp('/rbac', 'admin')
    rbac()
    on(
      'POST /admin/rbac/users',
      fail(422, 'VALIDATION_ERROR', 'x', {
        fields: { email: ['Email ini sudah dipakai pengguna lain.'] },
      }),
    )
    const table = await screen.findByRole('table')
    expect(table).toHaveTextContent(/Agus Prasetyo.*Nonaktif/)
    await userEvent.click(screen.getByRole('button', { name: 'Tambah pengguna' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Nama/), 'Wahyu Hidayat')
    await userEvent.type(within(dialog).getByLabelText(/Email/), 'user@example.com')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah' }))
    expect(
      await within(dialog).findByText('Email ini sudah dipakai pengguna lain.'),
    ).toBeInTheDocument()
  })

  it('Admin IT cannot uncheck admin.rbac.manage', async () => {
    renderApp('/rbac?tab=peran', 'admin')
    rbac()
    const box = await screen.findByRole('checkbox', { name: 'Pengguna & izin: Kelola' })
    expect(box).toBeChecked()
    expect(box).toBeDisabled()
  })

  it('saving a role sends the full permission list', async () => {
    renderApp('/rbac?tab=peran', 'admin')
    rbac()
    on('PUT /admin/rbac/roles/2/permissions', (c) =>
      ok({ ...roles()[1]!, permissions: (c.body as { permissions: string[] }).permissions }),
    )
    await userEvent.click(await screen.findByRole('tab', { name: 'User' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Personel: Lihat' }))
    await userEvent.click(screen.getByRole('button', { name: 'Simpan izin User' }))
    expect(await screen.findByText('Izin peran User disimpan')).toBeInTheDocument()
    const sent = calls.find((c) => c.method === 'PUT')!.body as { permissions: string[] }
    expect(sent.permissions).not.toContain('personel.view')
    expect(sent.permissions).toContain('barang.view')
  })

  it('a User without personel.view gets 403 on /personel and no menu entry', async () => {
    renderApp('/personel', 'user')
    on(
      'GET /auth/me',
      ok({
        ...users.user,
        permissions: users.user.permissions.filter((p) => p !== 'personel.view'),
      }),
    )
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Personel' })).not.toBeInTheDocument(),
    )
  })

  it('opens modal to create a new role and saves it', async () => {
    renderApp('/rbac?tab=peran', 'admin')
    rbac()
    on('POST /admin/rbac/roles', ok({ id: 3, code: 'staff_gudang', name: 'Staff Gudang', permissions: [] }))

    await userEvent.click(await screen.findByRole('button', { name: 'Tambah peran' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Tambah peran baru' })).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/Nama Peran/), 'Staff Gudang')
    await userEvent.type(within(dialog).getByLabelText(/Kode Peran/), 'staff_gudang')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah peran' }))

    expect(await screen.findByText('Peran Staff Gudang berhasil dibuat')).toBeInTheDocument()
  })
})
