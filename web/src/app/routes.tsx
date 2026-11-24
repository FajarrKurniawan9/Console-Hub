import { Route, Routes } from 'react-router'
import { AuditPage } from '../features/admin/audit/AuditPage'
import { ConsoleDetailPage } from '../features/admin/consoles/ConsoleDetailPage'
import { ConsolesPage } from '../features/admin/consoles/ConsolesPage'
import { LogsPage } from '../features/admin/logs/LogsPage'
import { OverviewPage } from '../features/admin/overview/OverviewPage'
import { RbacPage } from '../features/admin/rbac/RbacPage'
import { useAuth } from '../features/auth/auth'
import { AuthGoogleCallbackPage } from '../features/auth/AuthGoogleCallbackPage'
import { LoginPage } from '../features/auth/LoginPage'
import { BarangPage } from '../features/work/barang/BarangPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { LacakPage } from '../features/work/lacak/LacakPage'
import { PersonelPage } from '../features/work/personel/PersonelPage'
import { ProduksiPage } from '../features/work/produksi/ProduksiPage'
import { UserHomePage } from '../features/work/UserHomePage'
import type { Permission } from '../lib/api/schemas'
import { isAdminView } from '../lib/permissions'
import { AdminLayout } from './AdminLayout'
import { RequireAuth, RequirePermission } from './guards'
import { NotFoundPage } from './StatusPages'
import { UserLayout } from './UserLayout'

/** Shell is picked from `me`: `admin.dashboard.view` → Admin IT, otherwise User. */
function Shell() {
  const { user } = useAuth()
  return isAdminView(user) ? <AdminLayout /> : <UserLayout />
}

function Home() {
  const { user } = useAuth()
  return isAdminView(user) ? <OverviewPage /> : <UserHomePage />
}

const guarded = (perm: Permission, path: string, element: React.ReactNode) => (
  <Route key={path} element={<RequirePermission perm={perm} />}>
    <Route path={path} element={element} />
  </Route>
)

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/google/callback" element={<AuthGoogleCallbackPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          {guarded('dashboard.view', 'dashboard', <DashboardPage />)}
          {guarded('barang.view', 'barang', <BarangPage />)}
          {guarded('produksi.view', 'produksi', <ProduksiPage />)}
          {guarded('personel.view', 'personel', <PersonelPage />)}
          {guarded('lacak.view', 'lacak', <LacakPage />)}
          {guarded('lacak.view', 'lacak/:itemId', <LacakPage />)}
          {guarded('admin.consoles.view', 'console', <ConsolesPage />)}
          {guarded('admin.consoles.view', 'console/:id', <ConsoleDetailPage />)}
          {guarded('admin.logs.view', 'log', <LogsPage />)}
          {guarded('admin.rbac.manage', 'rbac', <RbacPage />)}
          {guarded('admin.audit.view', 'audit', <AuditPage />)}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
