import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

export type PolicyRuleCandidateState =
  | 'DRAFT'
  | 'PROPOSED'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'ACTIVATED'
  | 'SUPERSEDED'
  | 'REJECTED'

export type PolicyRuleCandidate = {
  ruleCandidateId: string
  ruleFamily: string
  candidateState: PolicyRuleCandidateState
  sourceAnchorRefs: Array<string>
  applicabilityScope: Record<string, unknown>
  extractedRationale: string
  draftRuleText: string
  severity?: string | null
  confidence?: number | null
  uncertaintyNotes?: string | null
  humanEdits: Array<Record<string, unknown>>
  approvalEvidence: Record<string, unknown>
  testEvidence: Record<string, unknown>
  activationRefs: Array<string>
  createdByActorType: string
  createdAt: string
  updatedAt: string
  isRuntimeAuthority: boolean
  nonAuthorityReason?: string | null
}

export type PolicyRuleCandidateInput = {
  ruleCandidateId?: string
  ruleFamily: string
  candidateState?: PolicyRuleCandidateState
  sourceAnchorRefs?: Array<string>
  applicabilityScope?: Record<string, unknown>
  extractedRationale: string
  draftRuleText: string
  severity?: string
  confidence?: number
  uncertaintyNotes?: string
  createdByActorType?: 'ai' | 'plugin' | 'human'
}

async function requestPolicyRule<T>(
  requestHeaders: HeadersInit | Headers,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders, {
    forwardBrowserCookies: true,
  })
  if (init?.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(withSemantierAgentBase(path), {
    ...init,
    headers,
  })
  const payload = (await response.json().catch(() => ({}))) as T & {
    detail?: unknown
    error?: unknown
  }
  if (!response.ok) {
    throw new Error(
      String(payload.detail || payload.error || `policy-rule-${response.status}`),
    )
  }
  return payload
}

export async function listPolicyRuleCandidates(
  requestHeaders: HeadersInit | Headers,
): Promise<Array<PolicyRuleCandidate>> {
  const payload = await requestPolicyRule<{ candidates: Array<PolicyRuleCandidate> }>(
    requestHeaders,
    '/api/knowledge/policy-rules',
  )
  return payload.candidates
}

export async function createPolicyRuleCandidate(
  requestHeaders: HeadersInit | Headers,
  input: PolicyRuleCandidateInput,
): Promise<PolicyRuleCandidate> {
  const payload = await requestPolicyRule<{ candidate: PolicyRuleCandidate }>(
    requestHeaders,
    '/api/knowledge/policy-rules',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return payload.candidate
}

export function candidateIsNonAuthoritative(candidate: PolicyRuleCandidate): boolean {
  return candidate.candidateState === 'DRAFT' || candidate.candidateState === 'PROPOSED'
}
