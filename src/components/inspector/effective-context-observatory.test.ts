import { describe, expect, it } from 'vitest'

import {
  effectiveContextEvidenceBundle,
  isCheckpointBranchable,
  type EffectiveContextPayload,
} from './effective-context-observatory'

describe('effective context observatory semantics', () => {
  it('uses the canonical server branchability decision rather than verification alone', () => {
    const degraded: EffectiveContextPayload = {
      checkpoint: { checkpoint_id: 'checkpoint_1' },
      verification: { status: 'verified', reason: 'VERIFIED' },
      closure: { closed: false, gaps: ['payload:missing'] },
      branchability: { status: 'degraded', remediation: 'restore_missing_payloads' },
    }
    const branchable: EffectiveContextPayload = {
      ...degraded,
      closure: { closed: true, gaps: [] },
      branchability: { status: 'branchable', remediation: null },
    }

    expect(isCheckpointBranchable(degraded)).toBe(false)
    expect(isCheckpointBranchable(branchable)).toBe(true)
  })

  it('exports the server-produced versioned evidence bundle', () => {
    const evidence = {
      schema: 'effective_context_observatory_evidence.v1',
      bundle_hash: 'abc123',
      checkpoint_id: 'checkpoint_1',
    }
    const snapshot: EffectiveContextPayload = {
      checkpoint: { checkpoint_id: 'checkpoint_1' },
      events: [{ event_id: 'event_1' }],
      evidence,
    }

    expect(effectiveContextEvidenceBundle(snapshot)).toEqual(evidence)
    expect(effectiveContextEvidenceBundle(snapshot)).not.toHaveProperty('events')
  })
})
