import { describe, expect, it } from 'vitest'

import { parseKnowledgeWorkbenchResult } from './knowledge-workbench-result'

describe('parseKnowledgeWorkbenchResult', () => {
  it('accepts deterministic graph interaction results', () => {
    const result = parseKnowledgeWorkbenchResult(
      JSON.stringify({
        message: '重要关系已排序',
        focus: {
          nodeIds: [],
          edgeIds: ['edge-1'],
          ruleIds: [],
          sourceAnchors: [],
        },
        candidateGraphId: 'candidate-1',
        acceptedReleaseId: null,
        proposedAction: 'inspect',
        interaction: {
          schemaVersion: 'graph_interaction.v1',
          commandId: 'cmd-1',
          candidateGraphId: 'candidate-1',
          acceptedReleaseId: null,
          action: 'highlight',
          nodeIds: [],
          edgeIds: ['edge-1'],
          dimOthers: true,
          viewport: 'fit_selection',
          reason: 'relationship_importance.v1',
        },
      }),
    )
    expect(result?.interaction?.edgeIds).toEqual(['edge-1'])
  })

  it('fails closed for malformed or non-governed output', () => {
    expect(parseKnowledgeWorkbenchResult('{"message":"untrusted"}')).toBeNull()
  })
})
