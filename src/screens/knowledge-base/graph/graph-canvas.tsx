import {
  ArrowRight,
  CircleAlert,
  FileText,
  GitBranch,
  Scale,
} from 'lucide-react'
import { useMemo } from 'react'

import { buildDeterministicGraphLayout } from './graph-layout'
import { SigmaGraph } from './sigma-graph'
import type {
  GovernedGraphProjection,
  GraphLens,
  GraphSelection,
} from './graph-types'
import { cn } from '@/lib/utils'

export function GraphCanvas({
  projection,
  lens,
  selection,
  highlightedNodeId,
  highlightedNodeIds = [],
  highlightedEdgeIds = [],
  dimOthers = false,
  onSelect,
}: {
  projection: GovernedGraphProjection
  lens: GraphLens
  selection: GraphSelection
  highlightedNodeId?: string
  highlightedNodeIds?: string[]
  highlightedEdgeIds?: string[]
  dimOthers?: boolean
  onSelect: (selection: GraphSelection) => void
}) {
  const scene =
    projection.scenes.find((candidate) => candidate.lens === lens) ??
    projection.scenes[0]
  const layout = useMemo(
    () =>
      buildDeterministicGraphLayout(projection.nodes, projection.edges, scene),
    [projection.edges, projection.nodes, scene],
  )

  return (
    <section
      aria-label="Governed graph scene"
      className="relative min-h-0 overflow-hidden rounded-card border border-border bg-card"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{scene.title}</h2>
          <p className="text-xs text-muted-foreground">{scene.description}</p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{projection.nodes.length} nodes</span>
          <span>{projection.edges.length} edges</span>
        </div>
      </div>
      <div className="relative h-[520px] overflow-auto">
        <SigmaGraph
          projection={projection}
          lens={lens}
          selection={selection}
          highlightedNodeIds={highlightedNodeIds}
          highlightedEdgeIds={highlightedEdgeIds}
          onSelect={onSelect}
        />
        <div className="hidden">
        <svg
          aria-hidden="true"
          className="absolute left-0 top-0"
          width={layout.width}
          height={layout.height}
        >
          {layout.edges.map((edge) => (
            <g key={edge.id}>
              <line
                x1={edge.sourcePoint.x + 62}
                y1={edge.sourcePoint.y + 32}
                x2={edge.targetPoint.x + 62}
                y2={edge.targetPoint.y + 32}
                stroke="var(--theme-border)"
                strokeWidth={
                  (selection.type === 'edge' && selection.id === edge.id) ||
                  highlightedEdgeIds.includes(edge.id)
                    ? 3
                    : 1.5
                }
                opacity={
                  dimOthers && !highlightedEdgeIds.includes(edge.id) ? 0.25 : 1
                }
                markerEnd="url(#graph-arrow)"
              />
              <foreignObject
                x={(edge.sourcePoint.x + edge.targetPoint.x) / 2 + 12}
                y={(edge.sourcePoint.y + edge.targetPoint.y) / 2}
                width="150"
                height="32"
              >
                <button
                  type="button"
                  className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-blue)]"
                  onClick={() => onSelect({ type: 'edge', id: edge.id })}
                >
                  {edge.predicateLabel}
                </button>
              </foreignObject>
            </g>
          ))}
          <defs>
            <marker
              id="graph-arrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="8"
              refY="4"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="var(--theme-border)" />
            </marker>
          </defs>
        </svg>
        {scene.nodeIds.map((nodeId) => {
          const node = projection.nodes.find(
            (candidate) => candidate.id === nodeId,
          )
          const point = layout.nodes[nodeId]
          if (!node || !point) return null
          const selected = selection.type === 'node' && selection.id === node.id
          const highlighted = highlightedNodeId === node.id
          const workbenchHighlighted = highlightedNodeIds.includes(node.id)
          const Icon =
            node.kind === 'authority'
              ? Scale
              : node.kind === 'conflict'
                ? CircleAlert
                : node.kind === 'source_span'
                  ? FileText
                  : GitBranch
          return (
            <button
              key={node.id}
              type="button"
              aria-label={`${node.kind}: ${node.label}, ${node.governanceState}`}
              className={cn(
                'absolute flex w-[126px] flex-col gap-2 rounded-md border bg-card p-3 text-left text-xs shadow-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-blue)]',
                selected ? 'border-[var(--theme-accent)]' : 'border-border',
                (highlighted || workbenchHighlighted) &&
                  'ring-2 ring-[var(--focus-blue)]',
                dimOthers && !workbenchHighlighted && 'opacity-30',
              )}
              style={{ left: point.x, top: point.y }}
              onClick={() => onSelect({ type: 'node', id: node.id })}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon className="size-4" aria-hidden="true" />
                <span className="min-w-0 truncate">{node.label}</span>
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <ArrowRight className="size-3" aria-hidden="true" />
                {node.authorityRole}
              </span>
              <span className="text-[10px]">{node.governanceState}</span>
            </button>
          )
        })}
        </div>
      </div>
      <details className="border-t border-border px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium">Keyboard graph objects</summary>
        <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-auto">
          {projection.nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className="rounded border border-border px-2 py-1 text-left hover:bg-muted"
              onClick={() => onSelect({ type: 'node', id: node.id })}
            >
              {node.label}
            </button>
          ))}
          {projection.edges.map((edge) => (
            <button
              key={edge.id}
              type="button"
              className="rounded border border-border px-2 py-1 text-left hover:bg-muted"
              onClick={() => onSelect({ type: 'edge', id: edge.id })}
            >
              {edge.predicateLabel}: {edge.source} → {edge.target}
            </button>
          ))}
        </div>
      </details>
    </section>
  )
}
