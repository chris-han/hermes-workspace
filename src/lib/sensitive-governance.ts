import { BASE_URL } from './gateway-api'

export const SENSITIVE_GOVERNANCE_CONTRACT_VERSION =
  'sensitive_governance.v1'
export const SENSITIVE_GOVERNANCE_HASH_PROFILE =
  'semantier-sensitive-governance-canonical-json-sha256-v1'

export type SensitiveGovernanceDisplayAction =
  | 'SHOW'
  | 'MASK'
  | 'TOKENIZE'
  | 'REDACT'
  | 'NEVER_RENDER'

export type SensitiveGovernanceSegmentKind =
  | 'TEXT'
  | 'SENSITIVE_TEXT'
  | 'REDACTION_NOTICE'
  | 'NEVER_RENDER_NOTICE'

export type SensitiveGovernanceAuthorityRef = {
  tier?: string
  authority_ref?: string
  artifact_id?: string
  display_name_zh?: string
  [key: string]: unknown
}

export type GovernedResponseSegment = {
  segment_id: string
  sequence: number
  kind: SensitiveGovernanceSegmentKind
  display_action: SensitiveGovernanceDisplayAction
  text: string
  classification?: string | null
  authority_refs?: Array<SensitiveGovernanceAuthorityRef> | null
  eligible_for_reveal?: boolean
  restricted_payload_ref?: string | null
}

export type SensitiveGovernancePins = {
  contract_version: string
  ontology_version: string
  authority_bundle_version: string
  policy_bundle_version: string
  display_profile_version: string
  fixture_manifest_hash: string
  decision_committed_event_id?: string | null
  execution_prepared_event_id?: string | null
  execution_terminal_event_id?: string | null
}

export type GovernedResponse = {
  response_id: string
  run_id: string
  contract_version: string
  segments: Array<GovernedResponseSegment>
  governance_summary: Record<string, unknown>
  pins: SensitiveGovernancePins
  response_hash: string
}

export type SensitiveGovernanceAssessment = {
  assessment_id: string
  state: string
  assessment_hash: string
  request_hash: string
  prepared_payload: SensitiveGovernancePreparedPayload
  [key: string]: unknown
}

export type SensitiveGovernanceInputDecision = {
  finding_class?: string
  enforcement_action?: string
  institutional_route?: string
  reason_codes?: Array<string>
  [key: string]: unknown
}

export type SensitiveGovernanceInputGovernance = {
  status?: string
  route?: string
  finding_count?: number
  decisions?: Array<SensitiveGovernanceInputDecision>
  transformations?: Array<Record<string, unknown>>
  policy_bundle_version?: string
  destination?: string
  reason_codes?: Array<string>
  escalation?: Record<string, unknown> | null
  [key: string]: unknown
}

export type SensitiveGovernanceExecutionIntent = {
  requires_confirmation?: boolean
  single_use?: boolean
  agent_boundary?: string
  transformed_input_hash?: string
  [key: string]: unknown
}

export type SensitiveGovernanceAgentBoundaryComparison = {
  raw_input_label?: string
  raw_request_hash?: string
  raw_detected_classes?: Array<string>
  governed_payload_label?: string
  governed_payload_hash?: string
  restricted_request_ref?: string
  destination?: string
  agent_boundary?: string
  transformation_actions?: Array<string>
  transformation_count?: number
  residual_scan_evidence_ref?: string
  residual_scan_evidence_hash?: string
  critical_residual_sensitive_data?: boolean
  browser_payload_custody?: string
  [key: string]: unknown
}

export type SensitiveGovernancePreparedPayload = {
  input_governance?: SensitiveGovernanceInputGovernance
  execution_intent?: SensitiveGovernanceExecutionIntent
  agent_boundary_comparison?: SensitiveGovernanceAgentBoundaryComparison
  server_owned_transformed_input?: string
  [key: string]: unknown
}

export type SensitiveGovernanceRun = {
  run_id: string
  assessment_id: string
  state: string
  governed_response: GovernedResponse
  governed_response_hash: string
  [key: string]: unknown
}

export type SensitiveGovernanceRevealDecision = {
  operation: 'reveal' | 'copy' | string
  response_id: string
  segment_id: string
  run_id?: string
  allowed: boolean
  reason_codes: Array<string>
  lease_id?: string | null
  expires_at?: string | null
  clear_value?: string
  [key: string]: unknown
}

export type SensitiveGovernanceReplayResult = {
  run_id: string
  replayed_response_hash: string
  governed_response_hash: string
  matches: boolean
  pins?: Record<string, unknown>
  policy_outcomes_hash?: string
  [key: string]: unknown
}

export type CreateSensitiveGovernanceAssessmentInput = {
  idempotency_key: string
  content?: string
  purpose?: string
  destination?: string
  source_kind?: 'pasted_text' | 'txt' | 'md'
  source_ref?: string
  session_id?: string
}

export type ExecuteSensitiveGovernanceAssessmentInput = {
  idempotency_key: string
  assessment_hash: string
  confirmation: boolean
}

export type SensitiveGovernanceSegmentActionInput = {
  idempotency_key: string
  purpose?: string
  confirmation: boolean
}

export type ReplaySensitiveGovernanceRunInput = {
  idempotency_key: string
}

function makeEndpoint(pathname: string): string {
  return new URL(pathname, BASE_URL).toString()
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Record<string, unknown>
    if (typeof payload.error === 'string') return payload.error
    if (typeof payload.message === 'string') return payload.message
    if (typeof payload.detail === 'string') return payload.detail
    return JSON.stringify(payload)
  } catch {
    return response.statusText || 'Sensitive governance request failed'
  }
}

async function requestSensitiveGovernanceJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    makeEndpoint(`/api/semantier-proxy${path}`),
    init,
  )
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  const payload = (await response.json()) as T & {
    ok?: boolean
    error?: string
  }
  if (payload.ok === false) {
    throw new Error(payload.error || 'Sensitive governance request failed')
  }
  return payload
}

export async function createSensitiveGovernanceAssessment(
  input: CreateSensitiveGovernanceAssessmentInput,
): Promise<SensitiveGovernanceAssessment> {
  const payload = await requestSensitiveGovernanceJson<{
    assessment: SensitiveGovernanceAssessment
  }>('/api/sensitive-governance/assessments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contract_version: SENSITIVE_GOVERNANCE_CONTRACT_VERSION,
      ...input,
    }),
  })
  return payload.assessment
}

export async function executeSensitiveGovernanceAssessment(
  assessmentId: string,
  input: ExecuteSensitiveGovernanceAssessmentInput,
): Promise<SensitiveGovernanceRun> {
  const payload = await requestSensitiveGovernanceJson<{
    run: SensitiveGovernanceRun
  }>(
    `/api/sensitive-governance/assessments/${encodeURIComponent(assessmentId)}/execute`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contract_version: SENSITIVE_GOVERNANCE_CONTRACT_VERSION,
        ...input,
      }),
    },
  )
  return payload.run
}

export async function fetchSensitiveGovernanceRun(
  runId: string,
): Promise<SensitiveGovernanceRun> {
  const payload = await requestSensitiveGovernanceJson<{
    run: SensitiveGovernanceRun
  }>(`/api/sensitive-governance/runs/${encodeURIComponent(runId)}`)
  return payload.run
}

export async function revealSensitiveGovernanceSegment(
  responseId: string,
  segmentId: string,
  input: SensitiveGovernanceSegmentActionInput,
): Promise<SensitiveGovernanceRevealDecision> {
  const payload = await requestSensitiveGovernanceJson<{
    decision: SensitiveGovernanceRevealDecision
  }>(
    `/api/sensitive-governance/responses/${encodeURIComponent(responseId)}/segments/${encodeURIComponent(segmentId)}/reveal`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contract_version: SENSITIVE_GOVERNANCE_CONTRACT_VERSION,
        ...input,
      }),
    },
  )
  return payload.decision
}

export async function copySensitiveGovernanceSegment(
  responseId: string,
  segmentId: string,
  input: SensitiveGovernanceSegmentActionInput,
): Promise<SensitiveGovernanceRevealDecision> {
  const payload = await requestSensitiveGovernanceJson<{
    decision: SensitiveGovernanceRevealDecision
  }>(
    `/api/sensitive-governance/responses/${encodeURIComponent(responseId)}/segments/${encodeURIComponent(segmentId)}/copy`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contract_version: SENSITIVE_GOVERNANCE_CONTRACT_VERSION,
        ...input,
      }),
    },
  )
  return payload.decision
}

export async function replaySensitiveGovernanceRun(
  runId: string,
  input: ReplaySensitiveGovernanceRunInput,
): Promise<SensitiveGovernanceReplayResult> {
  const payload = await requestSensitiveGovernanceJson<{
    replay: SensitiveGovernanceReplayResult
  }>(`/api/sensitive-governance/runs/${encodeURIComponent(runId)}/replay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contract_version: SENSITIVE_GOVERNANCE_CONTRACT_VERSION,
      ...input,
    }),
  })
  return payload.replay
}

export function sensitiveGovernanceCanonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    return `[${value.map((item) => sensitiveGovernanceCanonicalJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${sensitiveGovernanceCanonicalJson(record[key])}`,
      )
      .join(',')}}`
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value)
  }
  throw new Error(`Unsupported canonical JSON value: ${String(value)}`)
}

export async function sensitiveGovernanceCanonicalHash(
  value: unknown,
): Promise<string> {
  const encoded = new TextEncoder().encode(
    sensitiveGovernanceCanonicalJson(value),
  )
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
