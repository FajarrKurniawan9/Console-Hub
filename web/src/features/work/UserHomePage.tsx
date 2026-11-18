import { PageHeader } from '../../components/PageHeader'
import { useAuth } from '../auth/auth'

// Phase 1 shell. Phase 2 adds the main actions and the list of open orders.
export function UserHomePage() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title={`Halo, ${user?.name.split(' ')[0] ?? ''}`} />
      <p className="text-muted">Pilih menu di atas untuk mulai bekerja.</p>
    </div>
  )
}
