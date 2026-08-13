import { useEffect, useRef } from 'react'
import Sigma from 'sigma'

import type { GovernedGraphProjection, GraphLens, GraphSelection } from './graph-types'
import { buildSigmaGraph } from './sigma-graph-model'

export function SigmaGraph({
  projection,
  lens,
  selection,
  highlightedNodeIds,
  highlightedEdgeIds,
  onSelect,
}: {
  projection: GovernedGraphProjection
  lens: GraphLens
  selection: GraphSelection
  highlightedNodeIds: string[]
  highlightedEdgeIds: string[]
  onSelect: (selection: GraphSelection) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const scene = projection.scenes.find((candidate) => candidate.lens === lens) ?? projection.scenes[0]

  useEffect(() => {
    if (!containerRef.current) return
    const graph = buildSigmaGraph({
      projection,
      scene,
      selection,
      highlightedNodeIds,
      highlightedEdgeIds,
    })
    const renderer = new Sigma(graph, containerRef.current, {
      renderLabels: true,
      allowInvalidContainer: true,
    })
    renderer.on('clickNode', ({ node }) => onSelect({ type: 'node', id: node }))
    renderer.on('clickEdge', ({ edge }) => onSelect({ type: 'edge', id: edge }))
    sigmaRef.current = renderer
    return () => {
      renderer.kill()
      sigmaRef.current = null
    }
  }, [highlightedEdgeIds, highlightedNodeIds, lens, onSelect, projection, scene, selection])

  return (
    <div
      ref={containerRef}
      className="h-[520px] w-full rounded-md bg-card"
      role="application"
      aria-label="Sigma governed graph"
    />
  )
}
