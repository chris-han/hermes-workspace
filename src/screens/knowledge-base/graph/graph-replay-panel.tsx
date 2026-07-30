import { History } from 'lucide-react'

import type { GraphCopy } from './graph-lenses'
import type { GovernedGraphProjection } from './graph-types'

export function GraphReplayPanel({
  projection,
  copy,
}: {
  projection: GovernedGraphProjection
  copy: GraphCopy
}) {
  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <History className="size-4" aria-hidden="true" />
        {copy.replay}
      </h2>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {projection.events.map((event) => (
          <div key={event.id} className="rounded-md border border-border p-3 text-xs">
            <div className="font-semibold">{event.action}</div>
            <div className="mt-1 text-muted-foreground">
              {event.actorRole} · {event.occurredAt}
            </div>
            <div className="mt-2 break-words">{event.eventHash}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

