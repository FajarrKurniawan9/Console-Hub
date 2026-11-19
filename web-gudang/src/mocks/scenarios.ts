export const SCENARIOS = [
  'ok',
  'slow',
  'empty',
  'unauthenticated',
  'validation-error',
  'locked',
  'server-error',
  'rate-limited',
] as const

export type Scenario = (typeof SCENARIOS)[number]

export const SCENARIO_LABEL: Record<Scenario, string> = {
  ok: 'Normal',
  slow: 'Lambat (1,5–3 dtk)',
  empty: 'Semua daftar kosong',
  unauthenticated: 'Sesi selalu ditolak (401)',
  'validation-error': 'Simpan selalu gagal validasi (422)',
  locked: 'Penyesuaian selalu terkunci (409)',
  'server-error': 'Server galat (500)',
  'rate-limited': 'Login dibatasi (429)',
}

const KEY = 'gudang.mock-scenario'
const isScenario = (s: string | null): s is Scenario => SCENARIOS.some((x) => x === s)

function initial(): Scenario {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('scenario')
    if (isScenario(fromUrl)) {
      sessionStorage.setItem(KEY, fromUrl)
      return fromUrl
    }
    const stored = sessionStorage.getItem(KEY)
    return isScenario(stored) ? stored : 'ok'
  } catch {
    return 'ok'
  }
}

let current: Scenario = initial()

export const getScenario = () => current

export function setScenario(s: Scenario) {
  current = s
  try {
    sessionStorage.setItem(KEY, s)
  } catch {
    // Storage diblokir; skenario berlaku untuk tampilan ini saja.
  }
}

/** Kait tes: `instant` mematikan jeda buatan. */
export const mockConfig = { instant: false }
