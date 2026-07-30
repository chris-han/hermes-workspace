import { AlertTriangle } from 'lucide-react'

import type { GraphCopy } from './graph-lenses'
import type { GovernedGraphProjection } from './graph-types'

export function GraphConflictCompare({
  projection,
  copy,
}: {
  projection: GovernedGraphProjection
  copy: GraphCopy
}) {
  const conflict = projection.conflicts[0]
  if (!conflict) return null
  const left = projection.nodes.find((node) => node.id === conflict.leftNodeId)
  const right = projection.nodes.find((node) => node.id === conflict.rightNodeId)

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4" aria-hidden="true" />
        {copy.conflict}
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {[left, right].map((node) =>
          node ? (
            <div key={node.id} className="rounded-md border border-border p-3 text-xs">
              <div className="font-semibold">{node.label}</div>
              <p className="mt-1 text-muted-foreground">{node.summary}</p>
              <div className="mt-2">{node.authorityRole} · {node.semanticTier}</div>
            </div>
          ) : null,
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {conflict.type} · {conflict.status} · {conflict.resolverRationale}
      </p>
    </section>
  )
}

