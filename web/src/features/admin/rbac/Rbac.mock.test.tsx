import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { roles } from '../../../../mocks/data/users'
import { renderApp } from '../../../test/utils'

describe('RBAC', () => {
  it('lists users with role and status, and adds a user', async () => {
    renderApp('/rbac', 'admin')
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    expect(table).toHaveTextContent(/Agus Prasetyo.*Nonaktif/)
    await userEvent.click(screen.getByRole('button', { name: 'Tambah pengguna' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Nama/), 'Wahyu Hidayat')
    await userEvent.type(within(dialog).getByLabelText(/Email/), 'user@example.com')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah' }))
    expect(
      await within(dialog).findByText('Email ini sudah dipakai pengguna lain.'),
    ).toBeInTheDocument()
    const email = within(dialog).getByLabelText(/Email/)
    await userEvent.clear(email)
    await userEvent.type(email, 'wahyu@example.com')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah' }))
    expect(await screen.findByText('Wahyu Hidayat ditambahkan')).toBeInTheDocument()
  })

  it('Admin IT cannot uncheck admin.rbac.manage', async () => {
    renderApp('/rbac?tab=peran', 'admin')
    const box = await screen.findByRole('checkbox', { name: 'Pengguna & izin: Kelola' })
    expect(box).toBeChecked()
    expect(box).toBeDisabled()
    expect(screen.getByText(/tidak boleh kehilangan izin/)).toBeInTheDocument()
  })

  it('a permission change on the User role changes the User menu on the next me', async () => {
    renderApp('/rbac?tab=peran', 'admin')
    await userEvent.click(await screen.findByRole('tab', { name: 'User' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Divisi: Lihat' }))
    await userEvent.click(screen.getByRole('button', { name: 'Simpan izin User' }))
    expect(await screen.findByText('Izin peran User disimpan')).toBeInTheDocument()
    expect(roles.find((r) => r.code === 'user')!.permissions).not.toContain('divisi.view')
  })

  it('…and the User now sees no Divisi menu and gets 403 on /divisi', async () => {
    roles.find((r) => r.code === 'user')!.permissions = roles
      .find((r) => r.code === 'user')!
      .permissions.filter((p) => p !== 'divisi.view')
    renderApp('/divisi', 'user')
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Divisi' })).not.toBeInTheDocument()
  })

  it('saving the role you use reloads your own menu', async () => {
    renderApp('/rbac?tab=peran', 'admin')
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Audit: Lihat' }))
    await userEvent.click(screen.getByRole('button', { name: 'Simpan izin Admin IT' }))
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Audit' })).not.toBeInTheDocument(),
    )
  })
})
