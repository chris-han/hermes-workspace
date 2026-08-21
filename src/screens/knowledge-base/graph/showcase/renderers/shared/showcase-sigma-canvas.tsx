import { useMemo } from 'react'

import { SigmaGraphReadonly } from '../../../sigma-graph-readonly'
import type {
  SigmaGraphReadonlySelection,
  SigmaGraphReadonlyViewportController,
} from '../../../sigma-graph-readonly'
import type { ShowcaseGraphModel } from '../../semantica-showcase-types'
import {
  applySigmaModelControls,
  type SigmaControlState,
} from '../../sigma-control-state'

export type ShowcaseCanvasPositions = Record<string, { x: number; y: number }>

export interface ShowcaseCanvasViewportProps {
  positions?: ShowcaseCanvasPositions
  sigmaControls?: SigmaControlState
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
  sigmaControls,
  onSelect,
  onViewportReady,
  className,
}: {
  model: ShowcaseGraphModel
  positions?: ShowcaseCanvasPositions
  selection?: SigmaGraphReadonlySelection
  ariaLabel: string
  renderEdgeLabels?: boolean
  sigmaControls?: SigmaControlState
  onSelect?: (selection: SigmaGraphReadonlySelection) => void
  onViewportReady?: (controller: SigmaGraphReadonlyViewportController | null) => void
  className?: string
}) {
  const controlledModel = useMemo(
    () => (sigmaControls ? applySigmaModelControls(model, selection, sigmaControls) : model),
    [model, selection, sigmaControls],
  )
  const readonlyInput = useMemo(
    () => ({
      nodes: controlledModel.nodes,
      edges: controlledModel.edges,
      positions,
      selection,
      ariaLabel,
      renderEdgeLabels:
        sigmaControls?.edgeLabels === 'none' ? false : renderEdgeLabels,
      edgeArrows: sigmaControls?.edgeArrows,
    }),
    [
      ariaLabel,
      controlledModel.edges,
      controlledModel.nodes,
      positions,
      renderEdgeLabels,
      selection,
      sigmaControls?.edgeArrows,
      sigmaControls?.edgeLabels,
    ],
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
