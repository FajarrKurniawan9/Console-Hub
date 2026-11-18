import type { HubProcess } from '../../lib/schemas'

const c = {
  hr: { slug: 'hr', name: 'Web HR' },
  gudang: { slug: 'gudang', name: 'Web Gudang' },
  produksi: { slug: 'produksi', name: 'Web Produksi' },
}

export const processes: HubProcess[] = [
  {
    id: 1,
    name: 'Pesanan produksi baru',
    description:
      'Membuat pesanan di Produksi, memesan bahan baku di Gudang, lalu memasukkan pesanan ke antrean produksi.',
    is_active: true,
    compensate_on_failure: true,
    input_schema: {
      customer: { type: 'string', required: true, label: 'Nama pelanggan' },
      sku: { type: 'string', required: true, label: 'SKU barang jadi' },
      qty: { type: 'integer', required: true, min: 1, label: 'Jumlah (karton)' },
    },
    steps: [
      {
        position: 1,
        name: 'Buat pesanan',
        console: c.produksi,
        method: 'POST',
        path: '/api/orders',
        on_failure: 'stop',
        max_retries: 2,
        has_compensation: true,
      },
      {
        position: 2,
        name: 'Reservasi bahan baku',
        console: c.gudang,
        method: 'POST',
        path: '/api/reservations',
        on_failure: 'stop',
        max_retries: 2,
        has_compensation: true,
      },
      {
        position: 3,
        name: 'Masukkan ke antrean produksi',
        console: c.produksi,
        method: 'POST',
        path: '/api/queue',
        on_failure: 'stop',
        max_retries: 1,
        has_compensation: false,
      },
    ],
  },
  {
    id: 2,
    name: 'Onboarding karyawan baru',
    description:
      'Mendaftarkan karyawan di HR, memberi akses area gudang, lalu menambahkannya ke tim shift produksi.',
    is_active: true,
    compensate_on_failure: true,
    input_schema: {
      name: { type: 'string', required: true, label: 'Nama lengkap' },
      division: { type: 'string', required: true, label: 'Divisi' },
      role: { type: 'string', required: true, label: 'Jabatan' },
    },
    steps: [
      {
        position: 1,
        name: 'Buat data karyawan',
        console: c.hr,
        method: 'POST',
        path: '/v1/employees',
        on_failure: 'stop',
        max_retries: 1,
        has_compensation: true,
      },
      {
        position: 2,
        name: 'Beri akses area gudang',
        console: c.gudang,
        method: 'POST',
        path: '/api/area-access',
        on_failure: 'stop',
        max_retries: 2,
        has_compensation: true,
      },
      {
        position: 3,
        name: 'Daftarkan ke tim shift',
        console: c.produksi,
        method: 'POST',
        path: '/api/shift-teams/members',
        on_failure: 'stop',
        max_retries: 1,
        has_compensation: true,
      },
    ],
  },
  {
    id: 3,
    name: 'Nonaktifkan karyawan keluar',
    description:
      'Menonaktifkan karyawan di HR dan mencabut aksesnya di Gudang dan Produksi. Langkah terakhir tetap dicoba walau gagal.',
    is_active: true,
    compensate_on_failure: false,
    input_schema: {
      nik: { type: 'string', required: true, label: 'NIK karyawan' },
      reason: { type: 'string', label: 'Alasan keluar' },
    },
    steps: [
      {
        position: 1,
        name: 'Nonaktifkan karyawan',
        console: c.hr,
        method: 'PATCH',
        path: '/v1/employees/{nik}',
        on_failure: 'stop',
        max_retries: 1,
        has_compensation: false,
      },
      {
        position: 2,
        name: 'Cabut akses area gudang',
        console: c.gudang,
        method: 'DELETE',
        path: '/api/area-access/{nik}',
        on_failure: 'stop',
        max_retries: 2,
        has_compensation: false,
      },
      {
        position: 3,
        name: 'Keluarkan dari tim shift',
        console: c.produksi,
        method: 'DELETE',
        path: '/api/shift-teams/members/{nik}',
        on_failure: 'continue',
        max_retries: 0,
        has_compensation: false,
      },
    ],
  },
]

export const findProcess = (id: number) => processes.find((p) => p.id === id)
