import { LoaderCircle } from 'lucide-react'

/** Only inside buttons that are working. Lists use skeletons. */
export function Spinner() {
  return <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin" aria-hidden />
}
