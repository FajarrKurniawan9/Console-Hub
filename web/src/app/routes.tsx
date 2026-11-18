import { Route, Routes } from 'react-router'
import { AuditPage } from '../features/admin/audit/AuditPage'
import { ConsistencyPage } from '../features/admin/consistency/ConsistencyPage'
import { ConsoleDetailPage } from '../features/admin/consoles/ConsoleDetailPage'
import { ConsolesPage } from '../features/admin/consoles/ConsolesPage'
import { LogsPage } from '../features/admin/logs/LogsPage'
import { OverviewPage } from '../features/admin/overview/OverviewPage'
import { RbacPage } from '../features/admin/rbac/RbacPage'
import { TransactionDetailPage } from '../features/admin/transactions/TransactionDetailPage'
import { TransactionsPage } from '../features/admin/transactions/TransactionsPage'
import { useAuth } from '../features/auth/auth'
import { LoginPage } from '../features/auth/LoginPage'
import { BarangPage } from '../features/work/barang/BarangPage'
import { DivisiPage } from '../features/work/divisi/DivisiPage'
import { KaryawanPage } from '../features/work/karyawan/KaryawanPage'
import { PesananPage } from '../features/work/pesanan/PesananPage'
import { UserHomePage } from '../features/work/UserHomePage'
import type { Permission } from '../lib/api/schemas'
import { isAdminView } from '../lib/permissions'
import { TrailContext, useTrailState } from '../components/console-trail/useTransactionTrail'
import { AdminLayout } from './AdminLayout'
import { RequireAuth, RequirePermission } from './guards'
import { NotFoundPage } from './StatusPages'
import { UserLayout } from './UserLayout'

/** Shell is picked from `me`: `admin.dashboard.view` → Admin IT, otherwise User. */
function Shell() {
  const { user } = useAuth()
  const trail = useTrailState()
  return (
    <TrailContext value={trail}>
      {isAdminView(user) ? <AdminLayout /> : <UserLayout />}
    </TrailContext>
  )
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
          {guarded('admin.transactions.view', 'transaksi', <TransactionsPage />)}
          {guarded('admin.transactions.view', 'transaksi/:id', <TransactionDetailPage />)}
          {guarded('admin.consistency.view', 'konsistensi', <ConsistencyPage />)}
          {guarded('admin.rbac.manage', 'rbac', <RbacPage />)}
          {guarded('admin.audit.view', 'audit', <AuditPage />)}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
