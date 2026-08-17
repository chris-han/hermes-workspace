import Graph from 'graphology'

import type { GraphViewModel } from '@/contracts/graph-view-model'

/** Lossless renderer projection: canonical IDs are never replaced by Graphology IDs. */
export function projectGraphViewModel(model: GraphViewModel): Graph {
  const graph = new Graph({ type: 'directed', multi: true, allowSelfLoops: false })
  model.nodes.forEach((node) => {
    graph.addNode(node.id, {
      canonicalNodeId: node.id,
      label: node.label,
      semanticType: node.semanticType,
      evidenceRefs: node.evidenceRefs,
      groundingState: node.groundingState,
      properties: node.properties,
    })
  })
  model.edges.forEach((edge) => {
    if (!edge.sourceId || !edge.targetId) return
    graph.addEdgeWithKey(edge.id, edge.sourceId, edge.targetId, {
      canonicalEdgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      relationshipType: edge.relationshipType,
      evidenceRefs: edge.evidenceRefs,
      groundingState: edge.groundingState,
      weight: edge.weight,
      properties: edge.properties,
    })
  })
  return graph
}
