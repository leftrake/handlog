import { lazy, Suspense } from 'react'

// Charts are the heaviest dependency; load them only when the Stats tab opens.
const StatsPage = lazy(() => import('./StatsPage').then((m) => ({ default: m.StatsPage })))

export function LazyStatsPage() {
  return (
    <Suspense fallback={null}>
      <StatsPage />
    </Suspense>
  )
}
