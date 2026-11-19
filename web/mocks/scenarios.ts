export const SCENARIOS = [
  'ok',
  'slow',
  'empty',
  'unauthenticated',
  'forbidden',
  'validation-error',
  'rate-limited',
  'hr-down',
  'produksi-down',
  'gudang-down',
  'all-down',
  'slow-source',
  'conflict',
  'referenced',
] as const

export type Scenario = (typeof SCENARIOS)[number]

const KEY = 'ch.mock-scenario'
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

export function getScenario(): Scenario {
  return current
}

export function setScenario(s: Scenario) {
  current = s
  try {
    sessionStorage.setItem(KEY, s)
  } catch {
    // Storage blocked; the scenario lasts for this page view.
  }
}

/** Test hook. `instant`: no artificial HTTP latency (the `slow-source` 3 s delay included). */
export const mockConfig = { instant: false }
