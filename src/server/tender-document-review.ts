import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

export type TenderDetectionFinding = {
  finding_id: string
  issue_type: string
  matched_text: string
  judgment_basis: string
  severity: string
  confidence: number
  suggested_replacement?: string | null
  escalation_flag: boolean
  triggered_rule_version_id?: string
  source_anchor_refs?: Array<string>
  resolver_evidence_ref?: string
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
    documentText: string
    requestedRuleFamilies?: Array<string>
    localRules?: Array<Record<string, unknown>>
  },
): Promise<TenderDetectionRun> {
  const payload = await requestTenderReview<{ run: TenderDetectionRun }>(
    requestHeaders,
    '/api/tender-document-review/detections',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return payload.run
}

export async function recordTenderFindingDisposition(
  requestHeaders: HeadersInit | Headers,
  input: {
    runId: string
    findingId: string
    disposition: 'accepted' | 'rejected' | 'edited' | 'deferred'
    editedReplacement?: string
    rejectionRationale?: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestTenderReview<{ disposition: Record<string, unknown> }>(
    requestHeaders,
    `/api/tender-document-review/runs/${encodeURIComponent(input.runId)}/findings/${encodeURIComponent(input.findingId)}/disposition`,
    {
      method: 'POST',
      body: JSON.stringify({
        disposition: input.disposition,
        editedReplacement: input.editedReplacement,
        rejectionRationale: input.rejectionRationale,
      }),
    },
  )
  return payload.disposition
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
    `/api/tender-document-review/runs/${encodeURIComponent(input.runId)}/findings/${encodeURIComponent(input.findingId)}/feedback`,
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

export async function createTenderReport(
  requestHeaders: HeadersInit | Headers,
  runId: string,
): Promise<Record<string, unknown>> {
  const payload = await requestTenderReview<{ report: Record<string, unknown> }>(
    requestHeaders,
    `/api/tender-document-review/runs/${encodeURIComponent(runId)}/report`,
    {
      method: 'POST',
    },
  )
  return payload.report
}

export function findingHasAiAssistedSuggestion(
  finding: TenderDetectionFinding,
): boolean {
  return Boolean(finding.suggested_replacement?.includes('AI-assisted recommendation'))
}
