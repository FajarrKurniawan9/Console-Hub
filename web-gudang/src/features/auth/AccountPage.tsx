import { Button } from '../../components/ui/Button'
import { Panel, Topbar } from '../../components/Topbar'
import { useSession } from './useSession'

export function AccountPage() {
  const { user, logout } = useSession()
  return (
    <>
      <Topbar title="Akun" />
      <div className="max-w-lg p-6">
        <Panel>
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 p-4">
            <dt className="text-muted">Nama</dt>
            <dd>{user?.name}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{user?.email}</dd>
            <dt className="text-muted">Peran</dt>
            <dd>Staf Gudang</dd>
          </dl>
          <div className="border-t px-4 py-3">
            <Button onClick={() => void logout()}>Keluar</Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
