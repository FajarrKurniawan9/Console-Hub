import { http } from 'msw'
import { PERMISSIONS, type Permission } from '../../src/lib/api/schemas'
import { recordAudit } from '../data/audit'
import { PASSWORD, rbacView, roles, users } from '../data/users'
import { fail, guard, latency, ok, page, url } from '../http'

const body = async (r: Request) => (await r.json().catch(() => ({}))) as Record<string, unknown>
const known = new Set<string>(PERMISSIONS)

export const rbacHandlers = [
  http.get(url('/admin/rbac/users'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.rbac.manage')
    if (g.error) return g.error
    return page(users.map(rbacView), null, { total: users.length })
  }),

  http.post(url('/admin/rbac/users'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.rbac.manage')
    if (g.error) return g.error
    const b = await body(request)
    const name = String(b.name ?? '').trim()
    const email = String(b.email ?? '')
      .trim()
      .toLowerCase()
    const role = roles.find((r) => r.code === b.role_code)
    const fields: Record<string, string[]> = {}
    if (name.length < 3) fields.name = ['Nama wajib diisi, minimal 3 huruf.']
    if (!/^\S+@\S+\.\S+$/.test(email)) fields.email = ['Format email tidak valid.']
    else if (users.some((u) => u.email === email))
      fields.email = ['Email ini sudah dipakai pengguna lain.']
    if (!role) fields.role_code = ['Pilih peran.']
    if (Object.keys(fields).length)
      return fail('VALIDATION_ERROR', 'Periksa kembali isian yang ditandai.', {
        details: { fields },
      })
    const u = {
      id: Math.max(...users.map((x) => x.id)) + 1,
      name,
      email,
      roleId: role!.id,
      is_active: true,
    }
    users.push(u)
    recordAudit(g.user, 'rbac.user_created', { type: 'user', id: String(u.id) }, null, {
      email,
      role: role!.code,
    })
    // Mock: new accounts use the shared dummy password.
    return ok({ data: { ...rbacView(u), initial_password: PASSWORD } }, 201)
  }),

  http.patch(url('/admin/rbac/users/:id'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'admin.rbac.manage')
    if (g.error) return g.error
    const u = users.find((x) => x.id === Number(params.id))
    if (!u) return fail('NOT_FOUND', 'Pengguna tidak ditemukan.')
    const b = await body(request)
    const before = rbacView(u)
    if ('role_code' in b) {
      const role = roles.find((r) => r.code === b.role_code)
      if (!role)
        return fail('VALIDATION_ERROR', 'Peran tidak dikenal.', {
          details: { fields: { role_code: ['Pilih peran.'] } },
        })
      if (u.id === g.user.id && !role.permissions.includes('admin.rbac.manage'))
        return fail('CONFLICT', 'Anda tidak dapat mencabut akses RBAC dari akun Anda sendiri.')
      u.roleId = role.id
    }
    if ('is_active' in b) {
      if (u.id === g.user.id && b.is_active === false)
        return fail('CONFLICT', 'Anda tidak dapat menonaktifkan akun Anda sendiri.')
      u.is_active = !!b.is_active
    }
    const after = rbacView(u)
    recordAudit(g.user, 'rbac.user_updated', { type: 'user', id: String(u.id) }, null, {
      changes: Object.fromEntries(
        (['role', 'is_active'] as const)
          .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
          .map((k) => [
            k,
            {
              old: k === 'role' ? before.role.name : before[k],
              new: k === 'role' ? after.role.name : after[k],
            },
          ]),
      ),
    })
    return ok({ data: after })
  }),

  http.get(url('/admin/rbac/roles'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.rbac.manage')
    if (g.error) return g.error
    return page(structuredClone(roles), null, { total: roles.length })
  }),

  http.get(url('/admin/rbac/permissions'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.rbac.manage')
    if (g.error) return g.error
    return page([...PERMISSIONS], null, { total: PERMISSIONS.length })
  }),

  http.put(url('/admin/rbac/roles/:id/permissions'), async ({ request, params }) => {
    await latency()
    const g = guard(request, 'admin.rbac.manage')
    if (g.error) return g.error
    const role = roles.find((r) => r.id === Number(params.id))
    if (!role) return fail('NOT_FOUND', 'Peran tidak ditemukan.')
    const b = await body(request)
    const next = Array.isArray(b.permissions) ? (b.permissions as unknown[]).map(String) : null
    if (!next || next.some((p) => !known.has(p)))
      return fail('VALIDATION_ERROR', 'Daftar izin tidak valid.', {
        details: { fields: { permissions: ['Ada izin yang tidak dikenal.'] } },
      })
    if (role.code === 'admin_it' && !next.includes('admin.rbac.manage'))
      return fail(
        'CONFLICT',
        'Peran Admin IT tidak boleh kehilangan izin admin.rbac.manage; tidak ada yang dapat mengatur izin lagi.',
      )
    const old = role.permissions
    role.permissions = PERMISSIONS.filter((p) => next.includes(p)) as Permission[]
    recordAudit(g.user, 'rbac.role_updated', { type: 'role', id: role.code }, null, {
      changes: {
        ditambah: { old: null, new: role.permissions.filter((p) => !old.includes(p)) },
        dicabut: { old: old.filter((p) => !role.permissions.includes(p)), new: null },
      },
    })
    return ok({ data: structuredClone(role) })
  }),
]
