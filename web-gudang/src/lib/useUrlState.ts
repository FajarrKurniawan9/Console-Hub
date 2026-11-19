import { useSearchParams } from 'react-router'

/** Filter disimpan di URL agar bisa dibagikan dan bertahan saat kembali. */
export function useUrlState<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>
  const set = (k: K, v: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v) next.set(k, v)
        else next.delete(k)
        return next
      },
      { replace: true },
    )
  return [values, set] as const
}
