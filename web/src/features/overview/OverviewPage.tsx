import { PageHeader, Section } from '../../components/PageHeader'
import { CardsSkeleton } from '../../components/Skeletons'
import { ErrorState } from '../../components/ErrorState'
import { ConsoleCard } from '../consoles/ConsoleCard'
import { sortByAttention } from '../consoles/queries'
import { useOverview } from './queries'

export function OverviewPage() {
  const q = useOverview()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ringkasan"
        meta="Status console, hal yang perlu perhatian, dan eksekusi terbaru."
      />
      <Section title="Console">
        {q.isPending ? (
          <CardsSkeleton />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortByAttention(q.data.consoles).map((c) => (
              <ConsoleCard key={c.id} console={c} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
