import { describe, expect, it } from 'vitest'
import { projectGraphViewModel } from '@/screens/graph-explorer/graph/graphology-projection'
import { useContextGraphStudioStore } from '@/stores/contextgraph-studio-store'
import { uprightEdgeLabel } from '../edge-labels'

const model = (nodes = 3, edges = 3) => ({
  schemaVersion: 'semantier.graph_view_model.v2' as const,
  graphRef: 'release-ref', graphVersion: 'v0', graphHash: 'hash', authorityState: 'candidate' as const,
  candidateGraphId: 'candidate', acceptedReleaseId: null, sourceAnchors: [], sourceEvidenceRefs: [],
  nodes: Array.from({ length: nodes }, (_, i) => ({ id: `n${i}`, label: `Node ${i}`, semanticType: 'entity', properties: {}, sourceAnchors: [], evidenceRefs: [], evidenceRefDetails: [], groundingState: 'pending' as const, lineage: {} })),
  edges: Array.from({ length: edges }, (_, i) => ({ id: `e${i}`, sourceId: `n${i % nodes}`, targetId: `n${(i + 1) % nodes}`, relationshipType: i % 2 ? 'reverse' : 'related', weight: 1, properties: {}, sourceAnchors: [], evidenceRefs: [], evidenceRefDetails: [], groundingState: 'pending' as const, lineage: {} })),
})

describe('ContextGraph Sigma viewer contract', () => {
  it('projects canonical GraphViewModel.v2 without changing IDs', () => {
    const graph = projectGraphViewModel(model())
    expect(graph.type).toBe('directed')
    expect(graph.order).toBe(3)
    expect(graph.nodes()).toEqual(['n0', 'n1', 'n2'])
  })
  it('keeps directed parallel and reverse edges independently selectable', () => {
    const graph = projectGraphViewModel({ ...model(), edges: [
      { ...model().edges[0], id: 'forward', sourceId: 'n0', targetId: 'n1' },
      { ...model().edges[0], id: 'reverse', sourceId: 'n1', targetId: 'n0' },
      { ...model().edges[0], id: 'parallel', sourceId: 'n0', targetId: 'n1' },
    ] })
    expect(graph.size).toBe(3)
    expect(graph.edges('n0', 'n1')).toContain('forward')
    expect(graph.edges('n0', 'n1')).toContain('parallel')
    expect(graph.edges('n1', 'n0')).toContain('reverse')
  })
  it('normalizes labels so line separators cannot invert presentation', () => expect(uprightEdgeLabel('a\u2028b')).toBe('a b'))
  it('supports the six declared layouts', () => expect(['circular', 'circlepack', 'random', 'noverlaps', 'force-directed', 'force-atlas']).toHaveLength(6))
  it('toggles node drag as presentation state', () => { const s = useContextGraphStudioStore.getState(); s.setDragEnabled(false); expect(useContextGraphStudioStore.getState().dragEnabled).toBe(false); s.setDragEnabled(true) })
  it('enables large-graph performance at the documented thresholds', () => { const s = useContextGraphStudioStore.getState(); s.applyLargeGraphPerformance(1500, 1); expect(useContextGraphStudioStore.getState().largeGraphPerformance).toBe(true); s.applyLargeGraphPerformance(10, 4000); expect(useContextGraphStudioStore.getState().largeGraphPerformance).toBe(true) })
  it('keeps small graphs out of performance mode', () => { useContextGraphStudioStore.getState().applyLargeGraphPerformance(1, 1); expect(useContextGraphStudioStore.getState().largeGraphPerformance).toBe(false) })
  it('builds a 1500-node graph within the projection budget', () => { const start = performance.now(); expect(projectGraphViewModel(model(1500, 1500)).order).toBe(1500); expect(performance.now() - start).toBeLessThan(1500) })
  it('builds a 4000-node graph within the projection budget', () => { const start = performance.now(); expect(projectGraphViewModel(model(4000, 4000)).order).toBe(4000); expect(performance.now() - start).toBeLessThan(4000) })
  it('rejects stale selection when the identity changes', () => { const s = useContextGraphStudioStore.getState(); s.reset(); s.invalidateSelectionForIdentity({ graphRef: 'old', graphVersion: 'v0', graphHash: 'old-h', authorityState: 'candidate', semanticaCommit: null }); s.selectNode('old'); s.invalidateSelectionForIdentity({ graphRef: 'new', graphVersion: 'v1', graphHash: 'h', authorityState: 'candidate', semanticaCommit: null }); expect(useContextGraphStudioStore.getState().selectedNodeId).toBeNull() })
})
