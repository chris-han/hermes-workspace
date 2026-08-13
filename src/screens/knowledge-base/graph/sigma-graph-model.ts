import Graph from 'graphology'

import type { GovernedGraphProjection, GraphSelection } from './graph-types'

export function buildSigmaGraph({
  projection,
  scene,
  selection,
  highlightedNodeIds,
  highlightedEdgeIds,
}: {
  projection: GovernedGraphProjection
  scene: GovernedGraphProjection['scenes'][number]
  selection: GraphSelection
  highlightedNodeIds: string[]
  highlightedEdgeIds: string[]
}) {
  const graph = new Graph({ multi: true, type: 'directed' })
  const nodeIds = new Set(scene.nodeIds)
  projection.nodes
    .filter((node) => nodeIds.has(node.id))
    .forEach((node, index) => {
      const angle = (index / Math.max(scene.nodeIds.length, 1)) * Math.PI * 2
      graph.addNode(node.id, {
        label: node.label,
        x: Math.cos(angle),
        y: Math.sin(angle),
        size: selection.type === 'node' && selection.id === node.id ? 14 : 10,
        color: highlightedNodeIds.includes(node.id) ? '#2563eb' : '#64748b',
      })
    })
  projection.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .forEach((edge) => {
      graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
        label: edge.predicateLabel,
        size: highlightedEdgeIds.includes(edge.id) ? 3 : 1,
        color: highlightedEdgeIds.includes(edge.id) ? '#2563eb' : '#cbd5e1',
      })
    })
  return graph
}
