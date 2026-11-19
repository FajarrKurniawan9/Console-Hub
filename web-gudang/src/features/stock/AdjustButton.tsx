import { Button } from '../../components/ui/Button'
import type { Item } from '../../lib/api/types'

/** Diganti pada fase 4 dengan dialog penyesuaian. */
export function AdjustButton({ item }: { item: Item }) {
  return <Button disabled={item.locked}>Sesuaikan stok</Button>
}
