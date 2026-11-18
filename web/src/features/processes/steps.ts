import type { HubProcess } from '../../lib/schemas'

/** Unique consoles in step order. */
export function involvedConsoles(p: HubProcess) {
  const seen = new Map<string, { slug: string; name: string }>()
  for (const s of p.steps) if (!seen.has(s.console.slug)) seen.set(s.console.slug, s.console)
  return [...seen.values()]
}
