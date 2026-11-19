import { http, HttpResponse } from 'msw'
import { loginResult, uiUser } from '../../lib/api/schemas'
import { MOCK_ACCOUNT } from '../fixtures/catalog'
import { fail, issueToken, json, latency, one, route, url } from '../http'
import { getScenario } from '../scenarios'

const user = { id: MOCK_ACCOUNT.id, name: MOCK_ACCOUNT.name, email: MOCK_ACCOUNT.email }

export const authHandlers = [
  http.post(url('/auth/login'), async ({ request }) => {
    await latency()
    const s = getScenario()
    if (s === 'rate-limited')
      return fail('RATE_LIMITED', 'Terlalu banyak percobaan masuk. Coba lagi dalam 60 detik.', { retry_after: 60 })
    if (s === 'server-error') return fail('SERVER_ERROR', 'Terjadi galat di server gudang.')
    const b = await json(request)
    const fields: Record<string, string[]> = {}
    if (typeof b.email !== 'string' || !b.email.includes('@')) fields.email = ['Masukkan alamat email yang benar.']
    if (typeof b.password !== 'string' || !b.password) fields.password = ['Sandi wajib diisi.']
    if (Object.keys(fields).length) return fail('VALIDATION_ERROR', 'Ada isian yang belum benar.', { fields })
    if (b.email !== MOCK_ACCOUNT.email || b.password !== MOCK_ACCOUNT.password)
      return fail('UNAUTHENTICATED', 'Email atau sandi salah.')
    return one(loginResult, { token: issueToken(), user })
  }),
  route('post', '/auth/logout', () => new HttpResponse(null, { status: 204 })),
  route('get', '/auth/me', () => one(uiUser, user)),
]
