import type { EvidenceSelector } from '@/contracts/evidence-location'
import type { DocumentEnvelope } from '@/contracts/source-document'
import { resolveEvidenceSelector, type EvidenceResolution } from '@/lib/evidence-resolver'

export type GroundingDecision = 'accept' | 'edit' | 'reject' | 'reground'
export type GroundingRequest = { tenantId: string; workspaceId: string; candidateId: string; sourceIdentityRef: string; selector: EvidenceSelector; decision: GroundingDecision; replacementSelector?: EvidenceSelector }

/** Browser coordinates are hints. A grounding write is allowed only after the pinned envelope is resolved here. */
export function validateGroundingRequest(request: GroundingRequest, envelope: DocumentEnvelope): EvidenceResolution {
  if (request.tenantId !== envelope.source.tenantId || request.workspaceId !== envelope.source.workspaceId || request.sourceIdentityRef !== envelope.source.sourceIdentityRef) return { status: 'source_changed', location: null, candidates: [] }
  const selector = request.decision === 'reground' ? request.replacementSelector : request.selector
  if (!selector) return { status: 'unresolved', location: null, candidates: [] }
  return resolveEvidenceSelector(envelope, selector)
}
