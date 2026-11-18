export const RANGES = [
  { value: '1h', label: '1 jam', ms: 3_600_000 },
  { value: '24h', label: '24 jam', ms: 86_400_000 },
  { value: '7d', label: '7 hari', ms: 7 * 86_400_000 },
  { value: 'custom', label: 'Kustom', ms: 0 },
] as const

export type RangeValue = (typeof RANGES)[number]['value']
export const DEFAULT_RANGE: RangeValue = '24h'

/**
 * Turn a preset into from/to. `anchor` is fixed when the filter is applied so the
 * query key does not drift while the page is open (which would reload the list).
 */
export function resolveRange(range: string, fromLocal: string, toLocal: string, anchor: number) {
  if (range === 'custom') {
    return {
      from: fromLocal ? new Date(fromLocal).toISOString() : null,
      to: toLocal ? new Date(toLocal).toISOString() : null,
    }
  }
  const preset = RANGES.find((r) => r.value === range) ?? RANGES[1]
  return { from: new Date(anchor - preset.ms).toISOString(), to: null }
}
