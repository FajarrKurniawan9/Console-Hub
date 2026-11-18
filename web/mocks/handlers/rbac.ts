import { http } from 'msw'
import { roles, rbacView, users } from '../data/users'
import { guard, latency, page, url } from '../http'

// Phase 1: read-only lists (the audit filter needs users). Editing comes in phase 4.
export const rbacHandlers = [
  http.get(url('/admin/rbac/users'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.rbac.manage')
    if (g.error) return g.error
    return page(users.map(rbacView), null, users.length)
  }),
  http.get(url('/admin/rbac/roles'), async ({ request }) => {
    await latency()
    const g = guard(request, 'admin.rbac.manage')
    if (g.error) return g.error
    return page(structuredClone(roles), null, roles.length)
  }),
]
