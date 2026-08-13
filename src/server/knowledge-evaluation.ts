export type EvaluationLayer = 'extraction' | 'graph' | 'reasoning'

export type ProviderRole = 'semantier_semantica' | 'semantier_langextract'

export type CompatibilityProvider = 'semantica_service' | 'legacy'

export type ProviderId = ProviderRole | CompatibilityProvider | string

export type ExecutionMode = 'real' | 'recorded' | 'in_memory'

export type CertificationState =
  | 'PASS'
  | 'FAIL_CRITICAL'
  | 'PASS_WITH_WAIVER'
  | 'INVALID_RUN'
  | 'NOT_EVALUABLE'

// UI state model per §14.1 of the v2 plan.
export type UiState =
  | 'loading'
  | 'running'
  | 'empty'
  | 'partial'
  | 'failed'
  | 'invalid'
  | 'not-evaluable'
  | 'stale'

export type BenchmarkOrchestration = {
  benchmark_orchestration_id: string
  parent_orchestration_ref?: string | null
  profile_id: string
  profile_version: string
  requested_layers: Array<EvaluationLayer>
  execution_mode: ExecutionMode
  operational_status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  stale_reason_code?: string | null
  warnings: Array<{ code: string; providers?: Array<string> }>
  child_run_refs: Array<{
    layer: EvaluationLayer
    evaluation_run_id: string
    operational_status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
    run_validity?: 'VALID' | 'INVALID_EVALUATOR' | 'INVALID_ENVIRONMENT' | 'INVALID_FIXTURE' | null
    certification_result?: CertificationState | null
    provider_id?: ProviderId | null
    prediction_kind?: 'candidate' | 'accepted_release' | null
    parent_orchestration_ref?: string | null
    stale_reason_code?: string | null
  }>
  created_at: string
}

export type KnowledgeBenchmarkCase = {
  case_id: string
  layer: EvaluationLayer
  provider_id?: ProviderId | null
  provider_role?: ProviderRole | CompatibilityProvider | null
  status: UiState
  challenge_tags: string[]
  key_metric_contributions: string[]
  source_anchor_refs: string[]
  assertion_refs: string[]
  artifact_refs: string[]
}

export type KnowledgeBenchmarkChallengeSlice = {
  challenge_tag: string
  base_case_set_hash: string
  base_case_count: number
  included_case_count: number
  excluded_case_count: number
  excluded_case_refs: string[]
  denominator_policy: string
  metrics: Record<string, number>
  artifact_refs: string[]
}

const endpoint = '/api/semantier-proxy/api/knowledge/builder/benchmark-runs'

async function json<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { detail?: string; error?: string }
  if (!response.ok) throw new Error(payload.detail || payload.error || `evaluation-${response.status}`)
  return payload
}

export async function listBenchmarkOrchestrations(): Promise<Array<BenchmarkOrchestration>> {
  const payload = await json<{ benchmarkOrchestrations: Array<BenchmarkOrchestration> }>(
    await fetch(endpoint),
  )
  return payload.benchmarkOrchestrations
}

export async function launchBenchmark(input: {
  profileId: string
  profileVersion: string
  layers: Array<EvaluationLayer>
  executionMode: ExecutionMode
  providers?: Array<ProviderId>
}): Promise<BenchmarkOrchestration> {
  const payload = await json<{ benchmarkOrchestration: BenchmarkOrchestration }>(
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        benchmarkFamilyRef: 'knowledge-evaluation-stack.v2',
        providers: [],
        ...input,
      }),
    }),
  )
  return payload.benchmarkOrchestration
}

// §14.2 — Cases view must call the canonical governed endpoints.
export async function listKnowledgeBenchmarkCases(input: {
  evaluationRunId: string
}): Promise<Array<KnowledgeBenchmarkCase>> {
  const url = `/api/semantier-proxy/api/knowledge/builder/benchmark-runs/${encodeURIComponent(input.evaluationRunId)}/cases`
  const payload = await json<{ cases: Array<KnowledgeBenchmarkCase> }>(await fetch(url))
  return payload.cases
}

export async function listKnowledgeBenchmarkChallengeSlices(input: {
  evaluationRunId: string
}): Promise<Array<KnowledgeBenchmarkChallengeSlice>> {
  const url = `/api/semantier-proxy/api/knowledge/builder/benchmark-runs/${encodeURIComponent(input.evaluationRunId)}/challenge-slices`
  const payload = await json<{ challengeSlices: Array<KnowledgeBenchmarkChallengeSlice> }>(await fetch(url))
  return payload.challengeSlices
}

// Provider-role badge labels per §14.1 — sourced from the canonical
// benchmark/knowledge_evaluation/provider_taxonomy.py module so the
// frontend never hard-codes a label the backend disagrees with.
export const PROVIDER_ROLE_LABEL: Record<string, string> = {
  semantier_semantica: 'Baseline',
  semantier_langextract: 'Challenger',
  semantica_service: 'Compatibility',
  legacy: 'Compatibility',
  semantier_direct_llm: 'Invalid (not a Phase-1 provider ID)',
}

export function providerRoleLabel(providerId: string | null | undefined): string {
  if (!providerId) return 'Unspecified'
  return PROVIDER_ROLE_LABEL[providerId] ?? providerId
}

// Map canonical certification + status to the explicit UI state model.
export function deriveUiState(run: BenchmarkOrchestration['child_run_refs'][number]): UiState {
  if (run.operational_status === 'RUNNING') return 'running'
  if (run.operational_status === 'FAILED') return 'failed'
  if (run.operational_status === 'PARTIAL') return 'partial'
  if (run.run_validity && run.run_validity !== 'VALID') return 'invalid'
  if (run.certification_result === 'NOT_EVALUABLE') return 'not-evaluable'
  if (run.stale_reason_code) return 'stale'
  return 'empty'
}

export function knowledgeEvidenceLink(assertionRef?: string) {
  return assertionRef
    ? `/knowledge-base?mode=browse&tab=governance&view=graph&lens=evidence&assertion_id=${encodeURIComponent(assertionRef)}`
    : '/knowledge-base?mode=browse&tab=governance'
}