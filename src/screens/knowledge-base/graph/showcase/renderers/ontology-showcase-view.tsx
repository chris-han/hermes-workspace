import { useMemo } from 'react'

import type { OntologyHierarchyNode } from '../adapters/ontology-showcase-adapter'
import type { ShowcaseOntologyRendererInput } from '../semantica-showcase-types'
import {
  handleNodeSelection,
  selectionForNode,
  ShowcaseSigmaCanvas,
} from './shared/showcase-sigma-canvas'
import type { ShowcaseCanvasViewportProps } from './shared/showcase-sigma-canvas'

export function OntologyShowcaseView({
  input,
  hierarchy,
  maxDepth,
  selectedClassId,
  onSelect,
  positions,
  sigmaControls,
  onViewportReady,
  onCameraChange,
  renderEdgeLabels = true,
}: {
  input: ShowcaseOntologyRendererInput
  hierarchy: OntologyHierarchyNode[]
  maxDepth: number
  selectedClassId?: string
  onSelect: (classId: string) => void
  renderEdgeLabels?: boolean
} & ShowcaseCanvasViewportProps) {
  const ordered = useMemo(() => sortHierarchy(hierarchy), [hierarchy])
  const selectHandler = useMemo(() => handleNodeSelection(onSelect), [onSelect])
  void maxDepth

  return (
    <div className="flex h-full w-full flex-col gap-3" data-testid="ontology-showcase-view">
      <ShowcaseSigmaCanvas
        model={input.model}
        positions={positions ?? input.positions}
        sigmaControls={sigmaControls}
        selection={selectionForNode(selectedClassId)}
        ariaLabel="Ontology hierarchy showcase"
        renderEdgeLabels={renderEdgeLabels}
        onViewportReady={onViewportReady}
        onCameraChange={onCameraChange}
        onSelect={selectHandler}
      />
      <div className="sr-only" data-testid="ontology-tree">
        {ordered.map((node) => (
          <button
            key={node.id}
            type="button"
            data-testid={`ontology-class-${node.label}`}
            aria-pressed={selectedClassId === node.id}
            onClick={() => onSelect(node.id)}
          >
            {node.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function sortHierarchy(nodes: OntologyHierarchyNode[]): OntologyHierarchyNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const out: OntologyHierarchyNode[] = []
  const visit = (node: OntologyHierarchyNode) => {
    out.push(node)
    node.childIds
      .map((id) => byId.get(id))
      .filter((child): child is OntologyHierarchyNode => Boolean(child))
      .forEach(visit)
  }
  nodes.filter((node) => node.parentId === null).forEach(visit)
  return out
}
