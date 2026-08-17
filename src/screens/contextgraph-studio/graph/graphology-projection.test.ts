import { describe, expect, it } from 'vitest'

import { projectGraphViewModel } from './graphology-projection'

describe('GraphViewModel.v2 Graphology projection', () => {
  it('keeps directed reverse and parallel edges independently selectable', () => {
    const graph = projectGraphViewModel({
      schemaVersion: 'semantier.graph_view_model.v2',
      graphRef: 'g', graphVersion: 'v1', graphHash: 'h', authorityState: 'candidate',
      candidateGraphId: 'candidate', acceptedReleaseId: null, sourceAnchors: [], sourceEvidenceRefs: [],
      nodes: [
        { id: 'A', semanticType: 'concept', label: 'A', properties: {}, evidenceRefs: [], groundingState: 'pending' },
        { id: 'B', semanticType: 'concept', label: 'B', properties: {}, evidenceRefs: [], groundingState: 'pending' },
      ],
      edges: [
        { id: 'ev1', sourceId: 'A', targetId: 'B', relationshipType: 'requires', weight: 1, properties: {}, evidenceRefs: ['e1'], groundingState: 'pending' },
        { id: 'ev2', sourceId: 'A', targetId: 'B', relationshipType: 'exception_of', weight: 1, properties: {}, evidenceRefs: ['e2'], groundingState: 'pending' },
        { id: 'ev3', sourceId: 'B', targetId: 'A', relationshipType: 'derived_from', weight: 1, properties: {}, evidenceRefs: ['e3'], groundingState: 'pending' },
      ],
    })
    expect(graph.type).toBe('directed')
    expect(graph.multi).toBe(true)
    expect(graph.order).toBe(2)
    expect(graph.size).toBe(3)
    expect(new Set(graph.edges())).toEqual(new Set(['ev1', 'ev2', 'ev3']))
    expect(graph.getEdgeAttributes('ev2').canonicalEdgeId).toBe('ev2')
    expect(graph.getEdgeAttributes('ev3').sourceId).toBe('B')
  })
})
