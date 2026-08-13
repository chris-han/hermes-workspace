import { describe, expect, it } from 'vitest'

import { fixtureGovernedGraphProjection } from './graph-api-client'
import { buildSigmaGraph } from './sigma-graph-model'

describe('Sigma/Graphology graph adapter', () => {
  it('keeps parallel governed edges addressable by stable edge ids', () => {
    const projection = fixtureGovernedGraphProjection()
    const scene = projection.scenes[0]
    const parallelEdges = [
      ...projection.edges,
      {
        ...projection.edges[1],
        id: 'edge:clause-assertion:duplicate-review',
        predicate: 'also_supports',
        predicateLabel: 'also supports',
      },
    ]
    const graph = buildSigmaGraph({
      projection: { ...projection, edges: parallelEdges },
      scene,
      selection: { type: 'node', id: 'assertion:qualification' },
      highlightedNodeIds: [],
      highlightedEdgeIds: [],
    })

    expect(graph.hasEdge('edge:clause-assertion')).toBe(true)
    expect(graph.hasEdge('edge:clause-assertion:duplicate-review')).toBe(true)
    expect(graph.edges('clause:4.2', 'assertion:qualification')).toHaveLength(2)
  })
})
