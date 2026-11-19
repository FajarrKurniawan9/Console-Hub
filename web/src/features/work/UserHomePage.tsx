import { PageHeader } from '../../components/PageHeader'
import { useAuth } from '../auth/auth'

/** User home. Filled in phase 3 (shortcuts + latest items). */
export function UserHomePage() {
  const { user } = useAuth()
  return <PageHeader title={`Halo, ${user?.name.split(' ')[0] ?? ''}`} />
}
