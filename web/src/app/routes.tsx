import { Route, Routes } from 'react-router'
import { LoginPage } from '../features/auth/LoginPage'
import { ConsoleDetailPage } from '../features/consoles/ConsoleDetailPage'
import { ConsolesPage } from '../features/consoles/ConsolesPage'
import { LogsPage } from '../features/logs/LogsPage'
import { DataPage } from '../features/resources/DataPage'
import { OverviewPage } from '../features/overview/OverviewPage'
import { AppLayout } from './AppLayout'
import { RequireAdmin, RequireAuth } from './guards'
import { NotFoundPage, PendingPage } from './StatusPages'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="consoles" element={<ConsolesPage />} />
          <Route path="consoles/:id" element={<ConsoleDetailPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="processes/*" element={<PendingPage title="Proses" phase={4} />} />
          <Route path="runs/*" element={<PendingPage title="Eksekusi" phase={4} />} />
          <Route element={<RequireAdmin />}>
            <Route path="audit" element={<PendingPage title="Audit" phase={5} />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
