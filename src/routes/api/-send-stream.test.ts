import { describe, expect, it } from 'vitest'

import { resolveKnowledgeWorkbenchContextForSemantier } from './send-stream'

describe('resolveKnowledgeWorkbenchContextForSemantier', () => {
  it('omits the fresh empty workbench context instead of sending an invalid graph hint', () => {
    expect(
      resolveKnowledgeWorkbenchContextForSemantier({
        schemaVersion: 'knowledge_workbench_context.v2',
        activeFunction: null,
        userIntent: null,
        graphRef: null,
        graphVersion: null,
        graphHash: null,
        authorityState: 'candidate',
        runMode: null,
        candidateGraphId: null,
        acceptedReleaseId: null,
        acceptedReleaseVersion: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        selectedRuleIds: [],
        selectedCandidateId: null,
        selectedEvidenceRefs: [],
        activeSourceIdentityRef: null,
        sourceAnchors: [],
        governanceState: 'candidate',
        hasAcceptedRelease: false,
        extractionRunId: null,
        providerRef: null,
        providerCommit: null,
      }),
    ).toBeUndefined()
  })

  it('keeps complete graph identity hints for server re-resolution', () => {
    const context = {
      graphRef: 'phase1-001-v0-candidate',
      graphVersion: 'v1',
      graphHash: 'sha256:abc',
      selectedNodeIds: ['node-1'],
    }

    expect(resolveKnowledgeWorkbenchContextForSemantier(context)).toBe(context)
  })

  it('rejects partial graph identity hints before opening the upstream stream', () => {
    expect(() =>
      resolveKnowledgeWorkbenchContextForSemantier({
        graphRef: 'phase1-001-v0-candidate',
        graphVersion: 'v1',
        graphHash: null,
      }),
    ).toThrow('graphRef, graphVersion, and graphHash are required')
  })
})
