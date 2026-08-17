import { describe, expect, it } from 'vitest'

import { projectStudioWorkbenchContext } from './contextgraph-workbench-context'

const candidateIdentity = {
  graphRef: 'graph_v12',
  graphVersion: 'graph_v12',
  graphHash: 'sha256:abcd',
  authorityState: 'candidate' as const,
  semanticaCommit: 'commit-001',
}

const authoritativeIdentity = {
  graphRef: 'graph_v12',
  graphVersion: 'graph_v12',
  graphHash: 'sha256:abcd',
  authorityState: 'authoritative' as const,
  semanticaCommit: 'commit-001',
}

const emptyMvl = {
  v0RunRef: null,
  v1RunRef: null,
  learningDecision: null,
  evaluationRunId: null,
} as const

describe('contextgraph workbench context projector', () => {
  it('sets candidateGraphId for candidate graphs and clears acceptedReleaseId', () => {
    const ctx = projectStudioWorkbenchContext({
      mode: 'graph',
      identity: candidateIdentity,
      sourceIdentityRef: 'src_poc_sensitive_terms',
      extractionRunId: null,
      selectedCandidateId: null,
      selectedEvidenceRefs: [],
      selectedNodeId: 'rule-001',
      selectedEdgeId: null,
      mvlSummary: emptyMvl,
    })
    expect(ctx.candidateGraphId).toBe('graph_v12')
    expect(ctx.acceptedReleaseId).toBeNull()
    expect(ctx.selectedNodeIds).toEqual(['rule-001'])
    expect(ctx.runMode).toBeNull()
  })

  it('projects the active Studio function and tab navigation intent', () => {
    const ctx = projectStudioWorkbenchContext({
      mode: 'ground',
      identity: null,
      sourceIdentityRef: null,
      extractionRunId: null,
      selectedCandidateId: null,
      selectedEvidenceRefs: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      mvlSummary: emptyMvl,
    })

    expect(ctx.activeFunction).toEqual({
      surface: 'contextgraph-studio',
      function: 'human_grounding',
      tab: 'ground',
    })
    expect(ctx.userIntent).toEqual({
      kind: 'open_function',
      source: 'navigation',
      explicitness: 'implicit',
      targetType: null,
      targetIds: [],
    })
  })

  it('projects semantic selection intent without treating presentation state as intent', () => {
    const ctx = projectStudioWorkbenchContext({
      mode: 'graph',
      identity: candidateIdentity,
      sourceIdentityRef: null,
      extractionRunId: null,
      selectedCandidateId: null,
      selectedEvidenceRefs: [],
      selectedNodeId: 'rule-001',
      selectedEdgeId: null,
      mvlSummary: emptyMvl,
    })

    expect(ctx.userIntent).toEqual({
      kind: 'inspect_selection',
      source: 'web_ui',
      explicitness: 'implicit',
      targetType: 'node',
      targetIds: ['rule-001'],
    })
  })

  it('sets acceptedReleaseId for authoritative graphs and clears candidateGraphId', () => {
    const ctx = projectStudioWorkbenchContext({
      mode: 'graph',
      identity: authoritativeIdentity,
      sourceIdentityRef: null,
      extractionRunId: null,
      selectedCandidateId: null,
      selectedEvidenceRefs: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      mvlSummary: emptyMvl,
    })
    expect(ctx.acceptedReleaseId).toBe('graph_v12')
    expect(ctx.acceptedReleaseVersion).toBe('graph_v12')
    expect(ctx.candidateGraphId).toBeNull()
    expect(ctx.hasAcceptedRelease).toBe(true)
    expect(ctx.governanceState).toBe('active')
    expect(ctx.runMode).toBe('authoritative')
  })

  it('projects extract/ground candidate + evidence selection', () => {
    const ctx = projectStudioWorkbenchContext({
      mode: 'ground',
      identity: candidateIdentity,
      sourceIdentityRef: 'src_poc_sensitive_terms',
      extractionRunId: 'extraction_run_v1',
      selectedCandidateId: 'candidate-001',
      selectedEvidenceRefs: ['ev_73bc', 'ev_1a90'],
      selectedNodeId: null,
      selectedEdgeId: null,
      mvlSummary: emptyMvl,
    })
    expect(ctx.selectedCandidateId).toBe('candidate-001')
    expect(ctx.selectedEvidenceRefs).toEqual(['ev_73bc', 'ev_1a90'])
    expect(ctx.extractionRunId).toBe('extraction_run_v1')
    expect(ctx.activeSourceIdentityRef).toBe('src_poc_sensitive_terms')
    expect(ctx.runMode).toBeNull()
  })

  it('does not surface graph selections in sources/extract modes', () => {
    const ctx = projectStudioWorkbenchContext({
      mode: 'extract',
      identity: candidateIdentity,
      sourceIdentityRef: 'src_poc_sensitive_terms',
      extractionRunId: 'extraction_run_v1',
      selectedCandidateId: 'candidate-001',
      selectedEvidenceRefs: [],
      selectedNodeId: 'rule-001', // Studio has a node selected but Extract mode should not surface it
      selectedEdgeId: null,
      mvlSummary: emptyMvl,
    })
    expect(ctx.selectedNodeIds).toEqual([])
    expect(ctx.selectedEdgeIds).toEqual([])
    expect(ctx.selectedCandidateId).toBe('candidate-001')
  })

  it('surfaces evaluate run mode + decision when available', () => {
    const ctx = projectStudioWorkbenchContext({
      mode: 'evaluate',
      identity: candidateIdentity,
      sourceIdentityRef: null,
      extractionRunId: null,
      selectedCandidateId: null,
      selectedEvidenceRefs: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      mvlSummary: {
        v0RunRef: 'phase1-001-v0',
        v1RunRef: 'phase1-001-v1',
        learningDecision: 'GO',
        evaluationRunId: 'mvl_phase1_eval_001',
      },
    })
    expect(ctx.runMode).toBe('evaluation_baseline')
    expect(ctx.graphRef).toBe('graph_v12')
  })
})
