export type EvaluationLayer = 'extraction' | 'graph' | 'reasoning'

export type BenchmarkOrchestration = {
  benchmark_orchestration_id: string
  profile_id: string
  profile_version: string
  requested_layers: Array<EvaluationLayer>
  execution_mode: 'real' | 'recorded' | 'in_memory'
  operational_status: string
  warnings: Array<{ code: string; providers?: Array<string> }>
  child_run_refs: Array<{
    layer: EvaluationLayer
    evaluation_run_id: string
    operational_status: string
    certification_result?: string | null
  }>
  created_at: string
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
  executionMode: 'real' | 'recorded' | 'in_memory'
}): Promise<BenchmarkOrchestration> {
  const payload = await json<{ benchmarkOrchestration: BenchmarkOrchestration }>(
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        benchmarkFamilyRef: 'knowledge-evaluation-stack.v1',
        providers: [],
        ...input,
      }),
    }),
  )
  return payload.benchmarkOrchestration
}

export function knowledgeEvidenceLink(assertionRef?: string) {
  return assertionRef
    ? `/knowledge-base?mode=browse&tab=governance&view=graph&lens=evidence&assertion_id=${encodeURIComponent(assertionRef)}`
    : '/knowledge-base?mode=browse&tab=governance'
}
