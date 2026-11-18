import { LoaderCircle } from 'lucide-react'

/** Only for buttons that are processing. Lists and tables use skeletons. */
export function Spinner() {
  return <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin" aria-hidden />
}
