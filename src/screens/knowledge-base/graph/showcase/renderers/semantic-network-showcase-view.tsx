import { useMemo } from 'react'
import { SigmaGraphReadonly } from '../../sigma-graph-readonly'
import type { SigmaGraphReadonlySelection } from '../../sigma-graph-readonly'
import type { SigmaGraphReadonlyViewportController } from '../../sigma-graph-readonly'
import type { ShowcaseSemanticNetworkRendererInput } from '../semantica-showcase-types'

export function SemanticNetworkShowcaseView({
  input,
  distribution,
  onSelect,
  positions,
  onViewportReady,
}: {
  input: ShowcaseSemanticNetworkRendererInput
  distribution: {
    nodeTypes: Array<{ label: string; count: number }>
    edgeTypes: Array<{ label: string; count: number }>
  }
  onSelect: (selection: SigmaGraphReadonlySelection) => void
  positions?: Record<string, { x: number; y: number }>
  onViewportReady?: (controller: SigmaGraphReadonlyViewportController | null) => void
}) {
  const readonlyInput = useMemo(
    () => ({
      nodes: input.model.nodes,
      edges: input.model.edges,
      positions,
      ariaLabel: 'Semantic network showcase',
    }),
    [input.model.edges, input.model.nodes, positions],
  )

  return (
    <div className="flex h-full w-full flex-col gap-3" data-testid="semantic-network-showcase-view">
      <SigmaGraphReadonly
        input={readonlyInput}
        className="min-h-0 flex-1 w-full bg-transparent"
        onSelect={onSelect}
        onViewportReady={onViewportReady}
      />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <DistributionCard title="Node types" items={distribution.nodeTypes} testId="sn-node-types" />
        <DistributionCard title="Edge types" items={distribution.edgeTypes} testId="sn-edge-types" />
      </div>
    </div>
  )
}

function DistributionCard({
  title,
  items,
  testId,
}: {
  title: string
  items: Array<{ label: string; count: number }>
  testId: string
}) {
  return (
    <div
      className="rounded-md border border-border bg-card/60 px-3 py-2"
      data-testid={testId}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-1 flex flex-wrap gap-2 font-mono">
        {items.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          items.map((item) => (
            <span
              key={item.label}
              className="rounded-sm bg-muted px-2 py-0.5"
            >
              {item.label} · {item.count}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
