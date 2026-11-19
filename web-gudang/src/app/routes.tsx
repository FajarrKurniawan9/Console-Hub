import { Route, Routes } from 'react-router'
import { Topbar } from '../components/Topbar'
import { EmptyState } from '../components/EmptyState'
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
        <Route index element={<Placeholder title="Beranda" />} />
        <Route path="barang" element={<Placeholder title="Barang" />} />
        <Route path="rak" element={<Placeholder title="Rak" />} />
        <Route path="stok" element={<Placeholder title="Stok" />} />
        <Route path="reservasi" element={<Placeholder title="Reservasi" />} />
        <Route path="akses-area" element={<Placeholder title="Akses area" />} />
        <Route path="log" element={<Placeholder title="Log" />} />
        <Route path="akun" element={<AccountPage />} />
        <Route path="*" element={<Placeholder title="Halaman tidak ditemukan" />} />
      </Route>
      </Route>
    </Routes>
  )
}
