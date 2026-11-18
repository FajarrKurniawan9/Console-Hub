import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader'

export function ForbiddenPage() {
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="Tidak punya akses (403)" />
      <p>Halaman ini hanya untuk admin portal.</p>
      <p className="text-muted">Bila Anda perlu melihat catatan audit, minta akses ke admin.</p>
      <Link to="/" className="text-accent underline-offset-4 hover:underline">
        Kembali ke Ringkasan
      </Link>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="Halaman tidak ditemukan (404)" />
      <p className="text-muted">
        Alamat ini tidak ada di Console Hub. Periksa tautannya atau pilih menu di kiri.
      </p>
      <Link to="/" className="text-accent underline-offset-4 hover:underline">
        Kembali ke Ringkasan
      </Link>
    </div>
  )
}
