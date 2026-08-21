import { useMemo } from 'react'

import type { OntologyHierarchyNode } from '../adapters/ontology-showcase-adapter'
import type { ShowcaseOntologyRendererInput } from '../semantica-showcase-types'

export function OntologyShowcaseView({
  input,
  hierarchy,
  maxDepth,
  selectedClassId,
  onSelect,
}: {
  input: ShowcaseOntologyRendererInput
  hierarchy: OntologyHierarchyNode[]
  maxDepth: number
  selectedClassId?: string
  onSelect: (classId: string) => void
}) {
  const ordered = useMemo(() => sortHierarchy(hierarchy), [hierarchy])

  return (
    <div className="flex h-full w-full flex-col gap-3" data-testid="ontology-showcase-view">
      <div className="rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
        Hierarchy depth: {maxDepth + 1} · Classes: {input.classes.length} · Properties:{' '}
        {input.properties.length}
      </div>
      <ul
        className="flex-1 overflow-auto rounded-md border border-border bg-card p-3 font-mono text-sm"
        data-testid="ontology-tree"
        role="tree"
      >
        {ordered.map((node) => (
          <li
            key={node.id}
            role="treeitem"
            aria-selected={node.id === selectedClassId}
            className="cursor-pointer rounded-sm px-2 py-1 hover:bg-muted"
            style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
            onClick={() => onSelect(node.id)}
            data-testid={`ontology-class-${node.label}`}
          >
            <span
              className={
                node.id === selectedClassId
                  ? 'text-foreground font-semibold'
                  : 'text-foreground/80'
              }
            >
              {node.label}
            </span>
            <span className="ml-2 text-[11px] text-muted-foreground">
              {node.kind} · {node.instanceCount} instance{node.instanceCount === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
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
