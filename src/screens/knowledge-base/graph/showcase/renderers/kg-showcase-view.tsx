import { useMemo } from 'react'
import { SigmaGraphReadonly } from '../../sigma-graph-readonly'
import type { ShowcaseKgRendererInput } from '../semantica-showcase-types'
import type { SigmaGraphReadonlySelection } from '../../sigma-graph-readonly'
import type { SigmaGraphReadonlyViewportController } from '../../sigma-graph-readonly'
import type { ShowcaseInspectorField } from '../semantica-showcase-types'

export function KgShowcaseView({
  input,
  onSelect,
  positions,
  onViewportReady,
}: {
  input: ShowcaseKgRendererInput
  onSelect: (selection: SigmaGraphReadonlySelection) => void
  positions?: Record<string, { x: number; y: number }>
  onViewportReady?: (controller: SigmaGraphReadonlyViewportController | null) => void
}) {
  const readonlyInput = useMemo(
    () => ({
      nodes: input.model.nodes,
      edges: input.model.edges,
      positions,
      ariaLabel: 'Knowledge graph showcase',
    }),
    [input.model.edges, input.model.nodes, positions],
  )

  return (
    <div className="flex h-full w-full flex-col gap-3" data-testid="kg-showcase-view">
      <SigmaGraphReadonly
        input={readonlyInput}
        className="min-h-0 flex-1 w-full bg-transparent"
        onSelect={onSelect}
        onViewportReady={onViewportReady}
      />
      <InspectorSummary fields={input.inspector.fields} />
    </div>
  )
}

function InspectorSummary({ fields }: { fields: ShowcaseInspectorField[] }) {
  if (!fields.length) {
    return null
  }
  return (
    <div
      className="rounded-md border border-border bg-card/60 px-3 py-2 font-mono text-xs text-muted-foreground"
      data-testid="kg-showcase-summary"
    >
      {fields.map((field) => (
        <div key={field.label}>
          <span className="text-foreground/70">{field.label}:</span> {field.value}
        </div>
      ))}
    </div>
  )
}
