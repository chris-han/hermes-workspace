const LEGAL_CORPUS_PROXY_PREFIX = '/api/semantier-proxy/api/legal-corpus'

export type LegalSource = {
  source_id: string
  canonical_title?: string
  issuer?: string
  authority_tier?: string
  jurisdiction?: string
  expected_status?: string
  governance_state?: string
  document_number?: string | null
  content_hash?: string
}

export type LegalSourceVersion = {
  version_id: string
  source_id: string
  version_identity?: string
  source_hash?: string
  normalized_hash?: string | null
  effective_from?: string
  effective_to?: string | null
  lifecycle_state?: string
}

export type LegalSourceArtifact = {
  artifact_id: string
  version_id: string
  artifact_kind?: string
  uri?: string
  mime_type?: string
  storage_ref?: string
  content_hash?: string
  retrieved_at?: string
}

export type LegalSourceSection = {
  section_id: string
  version_id: string
  stable_locator?: string
  title?: string | null
  ordinal?: string | null
  anchor_json?: string
  local_hash?: string
}

export type LegalSemanticCandidate = {
  candidate_id: string
  version_id: string
  candidate_type?: string
  candidate_text?: string
  source_span_json?: string
  extraction_method?: string
  review_state?: string
  candidate_hash?: string
}

export type LegalRefreshCheck = {
  refresh_check_id: string
  source_id: string
  status?: string
  checked_at?: string
  checked_uri?: string
  observed_content_hash?: string
}

export type LegalScanRun = {
  scan_run_id: string
  organization_id?: string
  workspace_id?: string | null
  monitor_policy_version?: string
  scheduled_window?: string
  trigger?: string
  status?: string
  started_at?: string
  completed_at?: string | null
  aggregate_counts_json?: string
}

export type LegalScanItem = {
  scan_item_id: string
  scan_run_id: string
  organization_id?: string
  source_id: string
  monitor_policy_version?: string
  scheduled_window?: string
  idempotency_key?: string
  status?: string
  result_class?: string | null
  error_code?: string | null
  error_detail?: string | null
  observed_version_id?: string | null
  refresh_check_id?: string | null
  attempt_count?: number
}

export type LegalSourceStatusProjection = {
  source_id: string
  source_status?: {
    canonical_title?: string
    identity_state?: string
    availability_state?: string
    last_check?: LegalRefreshCheck | null
    next_due_check?: string | null
    raw_hash?: string | null
    normalized_hash?: string | null
    latest_comparison_class?: string | null
  }
  knowledge_status?: {
    active_version_ids?: Array<string>
    pending_version_ids?: Array<string>
    review_required?: boolean
    changed_anchors?: Array<unknown>
  }
  runtime_status?: {
    active_authority_bundle_version_id?: string | null
    posture?: string
    activation_ready?: boolean
  }
}

export type LegalChangeCandidate = LegalSemanticCandidate & {
  source_id?: string
  canonical_title?: string
  version_identity?: string
  version_lifecycle_state?: string
  stable_locator?: string | null
  section_type?: string | null
  candidate?: Record<string, unknown>
  source_span?: Record<string, unknown>
}

export type LegalCandidateImpact = {
  impact_report_ref?: string
  candidate?: LegalChangeCandidate
  legal_anchors?: Array<Record<string, unknown>>
  authority_edges?: Array<Record<string, unknown>>
  dependencies?: Array<Record<string, unknown>>
  posture?: string
  activation_performed?: boolean
}

export type LegalVersionEdge = {
  edge_id: string
  from_version_id: string
  to_version_id: string
  edge_type?: string
}

export type LegalCorpusInventory = {
  organization_id?: string
  sources: Array<LegalSource>
  versions: Array<LegalSourceVersion>
  artifacts: Array<LegalSourceArtifact>
  sections: Array<LegalSourceSection>
  refresh_checks: Array<LegalRefreshCheck>
  version_edges: Array<LegalVersionEdge>
  semantic_candidates: Array<LegalSemanticCandidate>
  metrics: Record<string, number | null>
}

export type LegalCorpusDashboard = {
  schema?: string
  organization_id?: string
  expected_source_count?: number | null
  metrics: Record<string, number | null>
  source_count?: number
  version_count?: number
}

export type LegalEvidenceContract = {
  schema?: string
  organization_id?: string
  active_pins?: Record<string, unknown> | null
  pipeline1_boundary?: {
    does_not_include?: Array<string>
  }
  contract_hash?: string
}

export type LegalAcceptanceEvidence = {
  schema?: string
  test_run_id?: string
  evidence_hash?: string
  source_inventory?: LegalCorpusInventory
  dashboard?: LegalCorpusDashboard
  active_pins?: Record<string, unknown> | null
  pipeline2_evidence_contract?: LegalEvidenceContract
}

export type LegalAcceptanceEvidenceExportRef = {
  acceptance_export_id: string
  test_run_id?: string
  organization_id?: string
  workspace_id?: string | null
  evidence_hash?: string
  record_hash?: string
  created_at?: string
}

export type RegisterLegalSourceInput = {
  canonical_title: string
  issuer: string
  authority_tier: string
  jurisdiction: string
  expected_status: string
  document_number?: string | null
  governance_state?: string
}

export type LegalUploadMetadataSuggestions = {
  canonical_title?: string
  issuer?: string
  document_number?: string
  effective_from?: string
  extraction_method?: string
}

export type LegalSourceUploadResult = {
  artifact: LegalSourceArtifact
  metadata_suggestions?: LegalUploadMetadataSuggestions
}

async function readLegalJson<T>(path: string): Promise<T> {
  const response = await fetch(`${LEGAL_CORPUS_PROXY_PREFIX}${path}`)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Knowledge base request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function writeLegalJson<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${LEGAL_CORPUS_PROXY_PREFIX}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Knowledge base request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function fetchLegalCorpusInventory(): Promise<LegalCorpusInventory> {
  const payload = await readLegalJson<{ inventory?: LegalCorpusInventory }>(
    '/inventory',
  )
  return (
    payload.inventory ?? {
      sources: [],
      versions: [],
      artifacts: [],
      sections: [],
      refresh_checks: [],
      version_edges: [],
      semantic_candidates: [],
      metrics: {},
    }
  )
}

export async function fetchLegalCorpusDashboard(): Promise<LegalCorpusDashboard> {
  const payload = await readLegalJson<{ dashboard?: LegalCorpusDashboard }>(
    '/dashboard?expected_source_count=65',
  )
  return payload.dashboard ?? { metrics: {} }
}

export async function fetchLegalEvidenceContract(): Promise<LegalEvidenceContract> {
  const payload = await readLegalJson<{
    evidence_contract?: LegalEvidenceContract
  }>('/pipeline2-evidence-contract')
  return payload.evidence_contract ?? {}
}

export async function fetchLegalAcceptanceEvidence(
  testRunId: string,
): Promise<LegalAcceptanceEvidence> {
  const params = new URLSearchParams({ test_run_id: testRunId })
  const payload = await readLegalJson<{
    acceptance_evidence?: LegalAcceptanceEvidence
  }>(`/acceptance-evidence-export?${params.toString()}`)
  return payload.acceptance_evidence ?? {}
}

export async function fetchLegalAcceptanceEvidenceExports(): Promise<
  Array<LegalAcceptanceEvidenceExportRef>
> {
  const payload = await readLegalJson<{
    acceptance_evidence_exports?: Array<LegalAcceptanceEvidenceExportRef>
  }>('/acceptance-evidence-exports')
  return payload.acceptance_evidence_exports ?? []
}

export async function fetchLegalScanRuns(
  limit = 20,
): Promise<Array<LegalScanRun>> {
  const params = new URLSearchParams({ limit: String(limit) })
  const payload = await readLegalJson<{ scan_runs?: Array<LegalScanRun> }>(
    `/scan-runs?${params.toString()}`,
  )
  return payload.scan_runs ?? []
}

export async function fetchLegalSourceStatus(
  sourceId: string,
  asOf?: string,
): Promise<LegalSourceStatusProjection> {
  const params = new URLSearchParams()
  if (asOf) params.set('as_of', asOf)
  const query = params.toString()
  const payload = await readLegalJson<{ status?: LegalSourceStatusProjection }>(
    `/sources/${encodeURIComponent(sourceId)}/status${query ? `?${query}` : ''}`,
  )
  return payload.status ?? { source_id: sourceId }
}

export async function fetchLegalChangeCandidates(
  reviewState?: string,
  limit = 25,
): Promise<Array<LegalChangeCandidate>> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (reviewState) params.set('review_state', reviewState)
  const payload = await readLegalJson<{
    change_candidates?: Array<LegalChangeCandidate>
  }>(`/change-candidates?${params.toString()}`)
  return payload.change_candidates ?? []
}

export async function fetchLegalCandidateImpact(
  candidateId: string,
): Promise<LegalCandidateImpact> {
  const payload = await readLegalJson<{ impact?: LegalCandidateImpact }>(
    `/change-candidates/${encodeURIComponent(candidateId)}/impact`,
  )
  return payload.impact ?? {}
}

export async function registerLegalSource(
  input: RegisterLegalSourceInput,
): Promise<LegalSource> {
  const payload = await writeLegalJson<{ source?: LegalSource }>('/sources', {
    ...input,
    governance_state: input.governance_state || 'LISTED',
  })
  if (!payload.source) {
    throw new Error(
      'Knowledge base source registration did not return a source',
    )
  }
  return payload.source
}

export async function uploadLegalSourceArtifact(
  versionId: string,
  file: File,
): Promise<LegalSourceUploadResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('artifact_kind', 'official_artifact_upload')
  const response = await fetch(
    `${LEGAL_CORPUS_PROXY_PREFIX}/versions/${encodeURIComponent(versionId)}/source-upload`,
    {
      method: 'POST',
      body: form,
    },
  )
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Knowledge base upload failed: ${response.status}`)
  }
  const payload = (await response.json()) as {
    artifact?: LegalSourceArtifact
    metadata_suggestions?: LegalUploadMetadataSuggestions
  }
  if (!payload.artifact) {
    throw new Error('Knowledge base upload did not return an artifact')
  }
  return {
    artifact: payload.artifact,
    metadata_suggestions: payload.metadata_suggestions,
  }
}
