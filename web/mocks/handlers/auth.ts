import { http } from 'msw'
import { recordAudit } from '../data/audit'
import { authView, PASSWORD, users } from '../data/users'
import { fail, guard, issueToken, latency, ok, revokeToken, url } from '../http'

export const authHandlers = [
  http.post(url('/auth/login'), async ({ request }) => {
    await latency()
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string }
    const fields: Record<string, string[]> = {}
    if (!body.email) fields.email = ['Email wajib diisi.']
    else if (!/^\S+@\S+\.\S+$/.test(body.email)) fields.email = ['Format email tidak valid.']
    if (!body.password) fields.password = ['Sandi wajib diisi.']
    if (Object.keys(fields).length)
      return fail('VALIDATION_ERROR', 'Data login tidak valid.', { details: { fields } })
    const user = users.find((u) => u.email === body.email)
    if (!user || body.password !== PASSWORD)
      return fail('UNAUTHENTICATED', 'Email atau sandi salah.')
    if (!user.is_active)
      return fail('FORBIDDEN', 'Akun Anda dinonaktifkan. Hubungi admin IT untuk mengaktifkannya.')
    recordAudit(user, 'auth.login', { type: 'user', id: String(user.id) }, null, null)
    return ok({ data: { token: issueToken(user.id), user: authView(user) } })
  }),

  http.post(url('/auth/logout'), async ({ request }) => {
    revokeToken(request)
    return new Response(null, { status: 204 })
  }),

  http.get(url('/auth/me'), async ({ request }) => {
    await latency()
    const g = guard(request)
    if (g.error) return g.error
    return ok({ data: authView(g.user) })
  }),
]
