import { afterEach, describe, expect, it } from 'vitest'

import {
  candidateIsNonAuthoritative,
  createPolicyRuleCandidate,
  listPolicyRuleCandidates,
} from './policy-rule-studio'

describe('policy-rule-studio server adapter', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('lists policy-rule candidates through governed backend routes', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/policy-rules')
      expect(init?.method ?? 'GET').toBe('GET')
      return new Response(
        JSON.stringify({
          candidates: [
            {
              ruleCandidateId: 'prc_1',
              ruleFamily: 'tender_compliance',
              candidateState: 'PROPOSED',
              sourceAnchorRefs: ['anchor_1'],
              applicabilityScope: { jurisdiction: 'CN' },
              extractedRationale: 'rationale',
              draftRuleText: 'draft',
              humanEdits: [],
              approvalEvidence: {},
              testEvidence: {},
              activationRefs: [],
              createdByActorType: 'plugin',
              createdAt: '2026-07-28T00:00:00+00:00',
              updatedAt: '2026-07-28T00:00:00+00:00',
              isRuntimeAuthority: false,
              nonAuthorityReason: 'not active',
            },
          ],
        }),
        { status: 200 },
      )
    }

    const candidates = await listPolicyRuleCandidates(new Headers())
    expect(candidates).toHaveLength(1)
    expect(candidateIsNonAuthoritative(candidates[0])).toBe(true)
  })

  it('creates draft/proposed candidates without treating them as runtime rules', async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/api/knowledge/policy-rules')
      expect(init?.method).toBe('POST')
      return new Response(
        JSON.stringify({
          candidate: {
            ruleCandidateId: 'prc_created',
            ruleFamily: 'tender_compliance',
            candidateState: 'DRAFT',
            sourceAnchorRefs: ['anchor_1'],
            applicabilityScope: { jurisdiction: 'CN' },
            extractedRationale: 'rationale',
            draftRuleText: 'draft',
            humanEdits: [],
            approvalEvidence: {},
            testEvidence: {},
            activationRefs: [],
            createdByActorType: 'ai',
            createdAt: '2026-07-28T00:00:00+00:00',
            updatedAt: '2026-07-28T00:00:00+00:00',
            isRuntimeAuthority: false,
            nonAuthorityReason: 'not active',
          },
        }),
        { status: 200 },
      )
    }

    const candidate = await createPolicyRuleCandidate(new Headers(), {
      ruleFamily: 'tender_compliance',
      candidateState: 'DRAFT',
      sourceAnchorRefs: ['anchor_1'],
      applicabilityScope: { jurisdiction: 'CN' },
      extractedRationale: 'rationale',
      draftRuleText: 'draft',
      createdByActorType: 'ai',
    })
    expect(candidate.ruleCandidateId).toBe('prc_created')
    expect(candidateIsNonAuthoritative(candidate)).toBe(true)
  })
})
