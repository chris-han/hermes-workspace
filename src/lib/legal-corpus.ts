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

async function readLegalJson<T>(path: string): Promise<T> {
  const response = await fetch(`${LEGAL_CORPUS_PROXY_PREFIX}${path}`)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Legal corpus request failed: ${response.status}`)
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
