import { Route, Routes } from 'react-router'
import { Topbar } from '../components/Topbar'
import { EmptyState } from '../components/EmptyState'
import { AreaAccessPage } from '../features/area-access/AreaAccessPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ItemsPage } from '../features/items/ItemsPage'
import { LogsPage } from '../features/logs/LogsPage'
import { ReservationsPage } from '../features/reservations/ReservationsPage'
import { AccountPage } from '../features/auth/AccountPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireSession } from '../features/auth/RequireSession'
import { AppShell } from './AppShell'

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <Topbar title={title} />
      <EmptyState message="Halaman ini sedang disiapkan." />
    </>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireSession />}>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="barang" element={<ItemsPage />} />
        <Route path="rak" element={<Placeholder title="Rak" />} />
        <Route path="stok" element={<Placeholder title="Stok" />} />
        <Route path="reservasi" element={<ReservationsPage />} />
        <Route path="akses-area" element={<AreaAccessPage />} />
        <Route path="log" element={<LogsPage />} />
        <Route path="akun" element={<AccountPage />} />
        <Route path="*" element={<Placeholder title="Halaman tidak ditemukan" />} />
      </Route>
      </Route>
    </Routes>
  )
}
