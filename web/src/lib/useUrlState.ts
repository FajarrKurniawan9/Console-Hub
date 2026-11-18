import { useSearchParams } from 'react-router'

/** Filters live in the URL so they survive reloads and can be shared. */
export function useUrlState() {
  const [sp, setSp] = useSearchParams()
  return {
    get: (key: string) => sp.get(key) ?? '',
    list: (key: string) => sp.get(key)?.split(',').filter(Boolean) ?? [],
    set: (patch: Record<string, string | string[] | null>) =>
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            const value = Array.isArray(v) ? v.join(',') : v
            if (value) next.set(k, value)
            else next.delete(k)
          }
          return next
        },
        { replace: true },
      ),
  }
}
