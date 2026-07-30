import { GitFork } from 'lucide-react'

import type { GraphCopy } from './graph-lenses'
import type { GovernedGraphProjection } from './graph-types'

export function GraphImpactPanel({
  projection,
  copy,
}: {
  projection: GovernedGraphProjection
  copy: GraphCopy
}) {
  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <GitFork className="size-4" aria-hidden="true" />
        {copy.impact}
      </h2>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {projection.impacts.map((impact) => (
          <div key={impact.artifactType} className="rounded-md border border-border p-3 text-xs">
            <div className="font-semibold">{impact.artifactType}</div>
            <div className="mt-1 text-muted-foreground">{impact.pathSummary}</div>
            <div className="mt-2">
              active {impact.activeCount} · historical {impact.historicalCount}
            </div>
            {impact.incomplete ? (
              <div className="mt-2 text-[color:var(--theme-warning)]">
                {copy.incompleteImpact}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

