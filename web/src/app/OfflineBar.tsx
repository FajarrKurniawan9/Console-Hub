import { WifiOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function OfflineBar() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  if (online) return null
  return (
    <p
      role="status"
      className="flex items-center gap-2 border-b border-warn bg-surface px-4 py-1.5 text-dense md:px-6"
    >
      <WifiOff size={16} strokeWidth={1.5} className="shrink-0 text-warn" aria-hidden />
      Koneksi internet terputus. Data yang tampil mungkin sudah usang; halaman akan memuat ulang
      otomatis saat tersambung lagi.
    </p>
  )
}
