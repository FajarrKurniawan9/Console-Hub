import { CircleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { downSince, useConsoles } from '../features/consoles/queries'
import { shortTime } from '../lib/format'

/** One thin line per dead console, under the top bar, on every page. */
export function GlobalDownBar() {
  const { data } = useConsoles()
  const down = data?.filter((c) => c.status === 'down') ?? []
  if (!down.length) return null
  return (
    <div role="status" className="flex flex-col border-b border-error bg-surface">
      {down.map((c) => {
        const since = downSince(c)
        return (
          <p key={c.id} className="flex items-center gap-2 px-4 py-1.5 text-dense md:px-6">
            <CircleAlert size={16} strokeWidth={1.5} className="shrink-0 text-error" aria-hidden />
            <span>
              <span className="font-semibold">{c.name}</span> tidak dapat dihubungi
              {since ? ` sejak ${shortTime(since)}` : ''}.
            </span>
            <Link
              to={`/consoles/${c.id}`}
              className="ml-auto shrink-0 text-accent underline-offset-4 hover:underline"
            >
              Lihat console
            </Link>
          </p>
        )
      })}
    </div>
  )
}
