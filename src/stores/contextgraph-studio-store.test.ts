import { describe, expect, it, beforeEach } from 'vitest'

import {
  useContextGraphStudioStore,
  resolveValidSelection,
} from './contextgraph-studio-store'

const baseIdentity = {
  graphRef: 'graph_v12',
  graphVersion: 'graph_v12',
  graphHash: 'sha256:abcd',
  authorityState: 'candidate' as const,
  semanticaCommit: null,
}

describe('contextgraph-studio store', () => {
  beforeEach(() => {
    useContextGraphStudioStore.getState().reset()
  })

  it('defaults to sources mode with a closed source pane', () => {
    const s = useContextGraphStudioStore.getState()
    expect(s.mode).toBe('sources')
    expect(s.sourceOpen).toBe(false)
    expect(s.selectedNodeId).toBeNull()
    expect(s.graphLayout).toBe('force-atlas')
  })

  it('updates presentation selection without mutating anything else', () => {
    const store = useContextGraphStudioStore
    store.getState().selectNode('rule-001')
    store.getState().selectEdge('e_requires')
    expect(store.getState().selectedNodeId).toBe('rule-001')
    expect(store.getState().selectedEdgeId).toBe('e_requires')
  })

  it('invalidates selection when canonical identity changes', () => {
    const store = useContextGraphStudioStore
    store.getState().selectNode('rule-001')
    store.getState().selectEdge('e_requires')
    store.getState().setCameraIntent({ x: 1, y: 1, ratio: 1 })

    // Same identity should NOT clear selection.
    store.getState().invalidateSelectionForIdentity(baseIdentity)
    expect(store.getState().selectedNodeId).toBe('rule-001')
    expect(store.getState().selectedEdgeId).toBe('e_requires')
    expect(store.getState().cameraIntent).not.toBeNull()

    // New graphRef must clear everything.
    store.getState().invalidateSelectionForIdentity({
      ...baseIdentity,
      graphRef: 'graph_v13',
    })
    expect(store.getState().selectedNodeId).toBeNull()
    expect(store.getState().selectedEdgeId).toBeNull()
    expect(store.getState().cameraIntent).toBeNull()
  })

  it('enables large-graph performance mode at the frozen thresholds', () => {
    const store = useContextGraphStudioStore
    store.getState().applyLargeGraphPerformance(500, 1000)
    expect(store.getState().largeGraphPerformance).toBe(false)

    store.getState().applyLargeGraphPerformance(1500, 100)
    expect(store.getState().largeGraphPerformance).toBe(true)

    store.getState().applyLargeGraphPerformance(100, 4000)
    expect(store.getState().largeGraphPerformance).toBe(true)
  })

  it('stores the MVL workflow summary for Compare/Evaluate surfaces', () => {
    const store = useContextGraphStudioStore
    store.getState().setMvlWorkflowSummary({
      v0RunRef: 'phase1-001-v0-candidate',
      v1RunRef: 'phase1-001-v1-candidate',
      learningDecision: 'GO',
      evaluationRunId: 'mvl_phase1_eval_001',
    })
    expect(store.getState().mvlWorkflowSummary.learningDecision).toBe('GO')
  })

  it('resolveValidSelection only returns IDs that exist in the view model', () => {
    const viewModel = {
      schemaVersion: 'semantier.graph_view_model.v2' as const,
      graphRef: 'graph_v12',
      graphVersion: 'graph_v12',
      graphHash: 'sha256:abcd',
      authorityState: 'candidate' as const,
      candidateGraphId: 'graph_v12',
      acceptedReleaseId: null,
      nodes: [
        {
          id: 'rule-001',
          semanticType: 'rule',
          label: 'rule',
          properties: {},
          evidenceRefs: [],
          groundingState: 'pending' as const,
        },
      ],
      edges: [
        {
          id: 'e_requires',
          sourceId: 'rule-001',
          targetId: 'concept-1',
          relationshipType: 'requires',
          weight: 1,
          properties: {},
          evidenceRefs: [],
          groundingState: 'pending' as const,
        },
      ],
      sourceAnchors: [],
      sourceEvidenceRefs: [],
    }
    const valid = resolveValidSelection(viewModel, 'rule-001', 'e_requires')
    expect(valid.node?.id).toBe('rule-001')
    expect(valid.edge?.id).toBe('e_requires')

    const invalid = resolveValidSelection(viewModel, 'rule-001', 'unknown')
    expect(invalid.edge).toBeNull()
  })
})