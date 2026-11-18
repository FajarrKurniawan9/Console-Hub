import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader'
import { useIsAdminView } from '../lib/permissions'

export function ForbiddenPage() {
  const admin = useIsAdminView()
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="Tidak punya akses (403)" />
      <p>Peran Anda tidak memiliki izin untuk membuka halaman ini.</p>
      <p className="text-muted">
        {admin
          ? 'Izin diatur per peran di halaman Pengguna & izin.'
          : 'Bila Anda memerlukannya untuk pekerjaan, hubungi admin IT.'}
      </p>
      <Link to="/" className="text-accent underline-offset-4 hover:underline">
        Kembali ke {admin ? 'Ringkasan' : 'Beranda'}
      </Link>
    </div>
  )
}

export function NotFoundPage() {
  const admin = useIsAdminView()
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="Halaman tidak ditemukan (404)" />
      <p className="text-muted">
        Alamat ini tidak ada di Console Hub. Periksa tautannya atau pilih menu.
      </p>
      <Link to="/" className="text-accent underline-offset-4 hover:underline">
        Kembali ke {admin ? 'Ringkasan' : 'Beranda'}
      </Link>
    </div>
  )
}
