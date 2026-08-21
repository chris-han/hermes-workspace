import { useMemo } from 'react'
import { SigmaGraphReadonly } from '../../sigma-graph-readonly'
import type { SigmaGraphReadonlySelection } from '../../sigma-graph-readonly'
import type { SigmaGraphReadonlyViewportController } from '../../sigma-graph-readonly'
import type { ShowcaseSemanticNetworkRendererInput } from '../semantica-showcase-types'

export function SemanticNetworkShowcaseView({
  input,
  onSelect,
  positions,
  onViewportReady,
}: {
  input: ShowcaseSemanticNetworkRendererInput
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
    </div>
  )
}
