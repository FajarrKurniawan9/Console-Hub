export const PEOPLE = [
  'Rina Wulandari',
  'Budi Santoso',
  'Siti Rahmawati',
  'Agus Prasetyo',
  'Dewi Lestari',
  'Hendra Gunawan',
  'Yuliana Sari',
  'Fajar Nugroho',
  'Ratna Kusuma',
  'Joko Susilo',
  'Maya Anggraini',
  'Teguh Wibowo',
] as const

export const username = (name: string) => name.split(' ')[0]!.toLowerCase()
