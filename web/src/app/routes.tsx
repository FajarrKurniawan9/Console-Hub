import { Route, Routes } from 'react-router'
import { AuditPage } from '../features/admin/audit/AuditPage'
import { ConsoleDetailPage } from '../features/admin/consoles/ConsoleDetailPage'
import { ConsolesPage } from '../features/admin/consoles/ConsolesPage'
import { LogsPage } from '../features/admin/logs/LogsPage'
import { OverviewPage } from '../features/admin/overview/OverviewPage'
import { useAuth } from '../features/auth/auth'
import { LoginPage } from '../features/auth/LoginPage'
import { BarangPage } from '../features/work/barang/BarangPage'
import { DivisiPage } from '../features/work/divisi/DivisiPage'
import { KaryawanPage } from '../features/work/karyawan/KaryawanPage'
import { PesananPage } from '../features/work/pesanan/PesananPage'
import { UserHomePage } from '../features/work/UserHomePage'
import type { Permission } from '../lib/api/schemas'
import { isAdminView } from '../lib/permissions'
import { AdminLayout } from './AdminLayout'
import { RequireAuth, RequirePermission } from './guards'
import { NotBuiltYet } from './NotBuiltYet'
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
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          {guarded('karyawan.view', 'karyawan', <KaryawanPage />)}
          {guarded('divisi.view', 'divisi', <DivisiPage />)}
          {guarded('barang.view', 'barang', <BarangPage />)}
          {guarded('pesanan.view', 'pesanan', <PesananPage />)}
          {guarded('admin.consoles.view', 'console', <ConsolesPage />)}
          {guarded('admin.consoles.view', 'console/:id', <ConsoleDetailPage />)}
          {guarded('admin.logs.view', 'log', <LogsPage />)}
          {guarded('admin.transactions.view', 'transaksi', <NotBuiltYet phase={3} />)}
          {guarded('admin.transactions.view', 'transaksi/:id', <NotBuiltYet phase={3} />)}
          {guarded('admin.consistency.view', 'konsistensi', <NotBuiltYet phase={4} />)}
          {guarded('admin.rbac.manage', 'rbac', <NotBuiltYet phase={4} />)}
          {guarded('admin.audit.view', 'audit', <AuditPage />)}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
