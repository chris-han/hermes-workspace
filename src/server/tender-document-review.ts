import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

export const TENDER_SENSITIVE_TERM_DETECTION_MODELING_DASHBOARD_CONTRACT =
  'tender_sensitive_term_detection_modeling.dashboard.v1'

export const TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE =
  '/api/tender-document-review'

export type TenderDetectionFinding = {
  finding_id: string
  issue_type: string
  matched_text: string
  judgment_basis: string
  severity: string
  confidence: number
  suggested_replacement?: string | null
  escalation_flag: boolean
  triggered_rule_version_id?: string | null
  triggered_rule_version_refs?: Array<Record<string, unknown>>
  winning_rule_version_ref?: string | null
  conflicting_rule_version_refs?: Array<Record<string, unknown>>
  conflict_resolution_ref?: string | null
  source_anchor_refs?: Array<string>
  resolver_evidence_ref?: string | null
  target_evidence_ref?: string | null
  target_anchor_ref?: string | null
  target_element_kind?: string | null
  target_element_id?: string | null
  target_element_hash?: string | null
  source_graph_version?: string | null
  source_graph_release_hash?: string | null
  source_graph_rule_id?: string | null
}

export type TenderDetectionRun = {
  run_id: string
  tender_document_id: string
  source_document_hash: string
  parent_run_id?: string | null
  root_run_id?: string | null
  findings: Array<TenderDetectionFinding>
  dispositions: Array<Record<string, unknown>>
}

async function requestTenderReview<T>(
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
      String(payload.detail || payload.error || `tender-review-${response.status}`),
    )
  }
  return payload
}

export async function createTenderDetection(
  requestHeaders: HeadersInit | Headers,
  input: {
    tenderDocumentId?: string
  documentText?: string
  fileRef?: string
  sessionId?: string
  sourceIdentity?: Record<string, unknown>
  canonicalSourceDocument?: Record<string, unknown>
    requestedRuleFamilies?: Array<string>
    localRules?: Array<Record<string, unknown>>
  },
): Promise<TenderDetectionRun> {
  const payload = await requestTenderReview<{ run: TenderDetectionRun }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/detections`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return payload.run
}

export async function getTenderDetectionRun(
  requestHeaders: HeadersInit | Headers,
  runId: string,
): Promise<TenderDetectionRun> {
  const payload = await requestTenderReview<{ run: TenderDetectionRun }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/runs/${encodeURIComponent(runId)}`,
  )
  return payload.run
}

export async function recordTenderFindingDisposition(
  requestHeaders: HeadersInit | Headers,
  input: {
    runId: string
    findingId: string
    disposition: 'accepted' | 'rejected' | 'edited' | 'deferred' | 'escalated'
    editedReplacement?: string
    rejectionRationale?: string
    justification?: string
    reasonCode?: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestTenderReview<{
    disposition: Record<string, unknown>
    semantic_feedback_event?: Record<string, unknown> | null
  }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/runs/${encodeURIComponent(input.runId)}/findings/${encodeURIComponent(input.findingId)}/disposition`,
    {
      method: 'POST',
      body: JSON.stringify({
        disposition: input.disposition,
        editedReplacement: input.editedReplacement,
        rejectionRationale: input.rejectionRationale,
        justification: input.justification,
        reasonCode: input.reasonCode,
      }),
    },
  )
  return payload
}

export async function recordTenderFindingFeedback(
  requestHeaders: HeadersInit | Headers,
  input: {
    runId: string
    findingId: string
    feedbackType:
      | 'false_positive'
      | 'false_negative'
      | 'ambiguity'
      | 'conflict'
      | 'remediation_rejected'
      | 'user_edited_remediation'
      | 'missing_control'
      | 'weak_explanation'
    userDisposition: Record<string, unknown>
    escalationOutcome?: 'not_escalated' | 'escalated' | 'resolved' | 'deferred'
    reviewerNotes?: string
    editedRemediation?: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestTenderReview<{ feedback: Record<string, unknown> }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/runs/${encodeURIComponent(input.runId)}/findings/${encodeURIComponent(input.findingId)}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify({
        feedbackType: input.feedbackType,
        userDisposition: input.userDisposition,
        escalationOutcome: input.escalationOutcome,
        reviewerNotes: input.reviewerNotes,
        editedRemediation: input.editedRemediation,
      }),
    },
  )
  return payload.feedback
}

export async function recordTenderRunMissedFindingFeedback(
  requestHeaders: HeadersInit | Headers,
  input: {
    runId: string
    sourceSpan: { text: string; startOffset: number; endOffset: number }
    reviewerNotes?: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestTenderReview<{ feedback: Record<string, unknown> }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/runs/${encodeURIComponent(input.runId)}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'missed_finding_feedback',
        feedbackType: 'false_negative',
        sourceSpan: input.sourceSpan,
        reviewerNotes: input.reviewerNotes,
      }),
    },
  )
  return payload.feedback
}

export async function createTenderReport(
  requestHeaders: HeadersInit | Headers,
  runId: string,
): Promise<Record<string, unknown>> {
  const payload = await requestTenderReview<{ report: Record<string, unknown> }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/runs/${encodeURIComponent(runId)}/report`,
    {
      method: 'POST',
    },
  )
  return payload.report
}

export async function createTenderLabeledDocx(requestHeaders: HeadersInit | Headers, runId: string) {
  const payload = await requestTenderReview<{ derivative: Record<string, unknown> }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/runs/${encodeURIComponent(runId)}/labeled-docx`,
    { method: 'POST' },
  )
  return payload.derivative
}

export async function getTenderReplay(requestHeaders: HeadersInit | Headers, runId: string) {
  const payload = await requestTenderReview<{ bundle: Record<string, unknown> }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/runs/${encodeURIComponent(runId)}/replay`,
  )
  return payload.bundle
}

export async function validateTenderGraphFocus(requestHeaders: HeadersInit | Headers, input: { finding: Record<string, unknown>; acceptedReleaseHash: string }) {
  return requestTenderReview<{ focus: Record<string, unknown> }>(
    requestHeaders,
    `${TENDER_DOCUMENT_REVIEW_COMPATIBILITY_ROUTE}/graph-focus`,
    { method: 'POST', body: JSON.stringify({ finding: input.finding, accepted_release_hash: input.acceptedReleaseHash }) },
  )
}

export function findingHasAiAssistedSuggestion(
  finding: TenderDetectionFinding,
): boolean {
  return Boolean(finding.suggested_replacement?.includes('AI-assisted recommendation'))
}
