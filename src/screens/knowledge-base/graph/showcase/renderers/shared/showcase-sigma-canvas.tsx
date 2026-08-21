import { useMemo } from 'react'

import { SigmaGraphReadonly } from '../../../sigma-graph-readonly'
import type {
  SigmaGraphReadonlySelection,
  SigmaGraphReadonlyViewportController,
} from '../../../sigma-graph-readonly'
import type { ShowcaseGraphModel } from '../../semantica-showcase-types'

export type ShowcaseCanvasPositions = Record<string, { x: number; y: number }>

export interface ShowcaseCanvasViewportProps {
  positions?: ShowcaseCanvasPositions
  onViewportReady?: (controller: SigmaGraphReadonlyViewportController | null) => void
}

export function selectionForNode(nodeId?: string): SigmaGraphReadonlySelection {
  return nodeId ? { type: 'node', id: nodeId } : null
}

export function handleNodeSelection(onSelect: (nodeId: string) => void) {
  return (selection: SigmaGraphReadonlySelection) => {
    if (selection?.type === 'node') {
      onSelect(selection.id)
    }
  }
}

export function ShowcaseSigmaCanvas({
  model,
  positions,
  selection,
  ariaLabel,
  renderEdgeLabels,
  onSelect,
  onViewportReady,
  className,
}: {
  model: ShowcaseGraphModel
  positions?: ShowcaseCanvasPositions
  selection?: SigmaGraphReadonlySelection
  ariaLabel: string
  renderEdgeLabels?: boolean
  onSelect?: (selection: SigmaGraphReadonlySelection) => void
  onViewportReady?: (controller: SigmaGraphReadonlyViewportController | null) => void
  className?: string
}) {
  const readonlyInput = useMemo(
    () => ({
      nodes: model.nodes,
      edges: model.edges,
      positions,
      selection,
      ariaLabel,
      renderEdgeLabels,
    }),
    [ariaLabel, model.edges, model.nodes, positions, renderEdgeLabels, selection],
  )

  return (
    <SigmaGraphReadonly
      input={readonlyInput}
      className={className ?? 'min-h-0 flex-1 w-full bg-transparent'}
      onSelect={onSelect}
      onViewportReady={onViewportReady}
    />
  )
}
