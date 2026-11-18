import { PageHeader } from '../components/PageHeader'

// Temporary placeholder while the brief is built phase by phase. Removed in phase 4.
export function NotBuiltYet({ phase }: { phase: number }) {
  return (
    <div className="flex flex-col gap-2">
      <PageHeader title="Belum tersedia" />
      <p className="text-muted">Layar ini dibangun pada fase {phase}.</p>
    </div>
  )
}
