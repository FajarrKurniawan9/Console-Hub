import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../test/a11y'
import { dedi, joko, kain, ok, on, page, tenun } from '../test/api'
import { audit, log, rbacUsers, roles } from '../test/admin'
import { renderApp } from '../test/utils'

const KAIN = kain.id
const ref = ({ id, name, role }: typeof joko) => ({ id, name, role })

/** Data for every admin screen in the axe sweep. */
function adminData() {
  on(
    'GET /admin/overview',
    ok({ sources: [], log_errors_24h: 0, recent_audit: [audit(1, 'item.created')] }),
  )
  on(
    'GET /admin/consoles/1',
    ok({
      id: 1,
      slug: 'hr',
      name: 'HR',
      base_url: 'https://hr.example',
      is_active: true,
      status: 'ok',
      latency_ms: 90,
      last_checked_at: '2026-11-19T02:00:00Z',
    }),
  )
  on('GET /admin/logs', page([log(1, 'info')]))
  on('GET /admin/audit', page([audit(1, 'item.created')]))
  on('GET /admin/rbac/users', page(rbacUsers))
  on('GET /admin/rbac/roles', page(roles()))
  on('GET /admin/rbac/permissions', page([]))
  on(
    `GET /tracking/items/${KAIN}`,
    ok({ item: kain, production: tenun, responsible: ref(joko), courier: ref(dedi), warnings: [] }),
  )
}
const ADMIN: [string, RegExp][] = [
  ['/', /Ringkasan/],
  ['/console', /^Sumber data$/],
  ['/console/1', /^HR$/],
  ['/log', /Log gabungan/],
  ['/rbac', /Pengguna & izin/],
  ['/rbac?tab=peran', /Pengguna & izin/],
  ['/audit', /^Audit$/],
  ['/barang', /^Barang$/],
  ['/produksi', /^Produksi$/],
  ['/personel', /^Personel$/],
  [`/lacak/${KAIN}`, /Lacak barang/],
]
const USER: [string, RegExp][] = [
  ['/', /Halo/],
  ['/barang', /^Barang$/],
  ['/produksi', /^Produksi$/],
  ['/personel', /^Personel$/],
  ['/lacak', /Lacak barang/],
  [`/lacak/${KAIN}`, /Lacak barang/],
  ['/log', /403/],
]

describe('axe (WCAG 2 A/AA, structure)', () => {
  it.each(ADMIN)('Admin %s', async (path, title) => {
    renderApp(path, 'admin')
    adminData()
    await screen.findByRole('heading', { level: 1, name: title })
    await screen.findAllByText(/./) // let the first data render
    expect(await axeViolations()).toEqual([])
  })

  it.each(USER)('User %s', async (path, title) => {
    renderApp(path, 'user')
    adminData()
    await screen.findByRole('heading', { level: 1, name: title })
    expect(await axeViolations()).toEqual([])
  })

  it('login page', async () => {
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Masuk' })
    expect(await axeViolations()).toEqual([])
  })

  it('register page', async () => {
    renderApp('/register')
    await screen.findByRole('heading', { name: 'Daftar Akun' })
    expect(await axeViolations()).toEqual([])
  })

  it('item form (User)', async () => {
    renderApp('/barang', 'user')
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah barang' }))
    await screen.findByRole('dialog', { name: 'Tambah barang' })
    expect(await axeViolations()).toEqual([])
  })
})

describe('keyboard', () => {
  it('skip link, then the item form opens and closes from the keyboard', async () => {
    const user = userEvent.setup()
    renderApp('/barang', 'user')
    await screen.findByRole('button', { name: 'Tambah barang' })
    await user.tab()
    expect(screen.getByRole('link', { name: 'Lewati ke konten' })).toHaveFocus()
    screen.getByRole('button', { name: 'Tambah barang' }).focus()
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Tambah barang' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tambah barang' })).toHaveFocus())
  })

  it('table rows open their drawer with Enter', async () => {
    const user = userEvent.setup()
    renderApp('/barang', 'admin')
    const row = await screen.findByRole('row', { name: 'Detail Kain katun' })
    row.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Kain katun' })).toBeInTheDocument()
  })
})

describe('axe: drawers and source-down states', () => {
  it('item drawer (Admin)', async () => {
    renderApp('/barang', 'admin')
    await userEvent.click(await screen.findByRole('row', { name: 'Detail Kain katun' }))
    await screen.findByRole('dialog', { name: 'Kain katun' })
    expect(await axeViolations()).toEqual([])
  })

  it('Lacak barang with hr-down (User)', async () => {
    renderApp(`/lacak/${KAIN}`, 'user')
    on(
      `GET /tracking/items/${KAIN}`,
      ok({
        item: { ...kain, responsible: null },
        production: { ...tenun, courier: null },
        responsible: null,
        courier: null,
        warnings: ['Data personel sedang tidak tersedia.'],
      }),
    )
    await screen.findByText('Data personel sedang tidak tersedia.')
    expect(await axeViolations()).toEqual([])
  })
})
