// PRNG berbenih agar data mock (dan tes) sama setiap dimuat.
export function seeded(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
  }
}

export const pad = (n: number, width = 3) => String(n).padStart(width, '0')

/** UUID v4 yang valid dan stabil untuk fixture, mis. uid('a1', 3). */
export const uid = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${pad(n, 12)}`
