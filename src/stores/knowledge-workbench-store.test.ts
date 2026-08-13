import { beforeEach, describe, expect, it } from 'vitest'

import { useKnowledgeWorkbenchStore } from './knowledge-workbench-store'

const context = {
  candidateGraphId: 'candidate-1', acceptedReleaseId: null, acceptedReleaseVersion: null,
  selectedNodeIds: [], selectedEdgeIds: [], selectedRuleIds: [], sourceAnchors: [],
  governanceState: 'candidate' as const, hasAcceptedRelease: false, extractionRunId: null,
  providerRef: null, providerCommit: null,
}
const graph = { candidateGraphId: 'candidate-1', acceptedReleaseId: null, nodes: [{ id: 'n1' }], edges: [{ id: 'e1' }], sourceAnchors: [] }
const command = (overrides = {}) => ({
  schemaVersion: 'graph_interaction.v1' as const, commandId: 'cmd-1',
  candidateGraphId: 'candidate-1', acceptedReleaseId: null, action: 'highlight' as const,
  nodeIds: ['n1'], edgeIds: ['e1'], dimOthers: true, viewport: 'fit_selection' as const,
  reason: null, ...overrides,
})

describe('knowledge workbench store', () => {
  beforeEach(() => useKnowledgeWorkbenchStore.setState({ context, presentation: { highlightedNodeIds: [], highlightedEdgeIds: [], dimOthers: false, viewport: 'unchanged' }, diagnostic: null, appliedCommandIds: new Set() }))

  it('atomically applies authorized commands and deduplicates command ids', () => {
    const store = useKnowledgeWorkbenchStore.getState()
    store.setContext(context)
    expect(store.applyInteraction(command(), graph)).toBe(true)
    expect(useKnowledgeWorkbenchStore.getState().presentation.highlightedEdgeIds).toEqual(['e1'])
    expect(store.applyInteraction(command(), graph)).toBe(false)
    expect(useKnowledgeWorkbenchStore.getState().diagnostic).toBe('graph_interaction_rejected_duplicate')
  })

  it('rejects stale and missing ids without partial mutation', () => {
    const store = useKnowledgeWorkbenchStore.getState()
    store.setContext(context)
    expect(store.applyInteraction(command({ candidateGraphId: 'other' }), graph)).toBe(false)
    expect(store.applyInteraction(command({ commandId: 'cmd-2', edgeIds: ['missing'] }), graph)).toBe(false)
    expect(useKnowledgeWorkbenchStore.getState().presentation.highlightedEdgeIds).toEqual([])
  })

  it('clears focus when graph identity changes', () => {
    const store = useKnowledgeWorkbenchStore.getState()
    store.setContext(context)
    store.applyInteraction(command(), graph)
    store.setContext({ ...context, candidateGraphId: 'candidate-2' })
    expect(useKnowledgeWorkbenchStore.getState().presentation.highlightedNodeIds).toEqual([])
  })
})
