import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

async function requestKnowledgeBuilderEvaluation<T>(
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
      String(
        payload.detail || payload.error || `knowledge-builder-evaluation-${response.status}`,
      ),
    )
  }
  return payload
}

export async function createKnowledgeBuilderEvaluationDataset(
  requestHeaders: HeadersInit | Headers,
  input: {
    discoveryRunId?: string
    useTenderUatFixture?: boolean
    domain?: string
    name?: string
    description?: string
    examples?: Array<Record<string, unknown>>
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilderEvaluation<{
    evaluationDataset: Record<string, unknown>
  }>(requestHeaders, '/api/knowledge/builder/evaluation-datasets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return payload.evaluationDataset
}

export async function runKnowledgeBuilderEvaluation(
  requestHeaders: HeadersInit | Headers,
  input: { evaluationDatasetId: string; discoveryRunId?: string },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilderEvaluation<{
    evaluationRun: Record<string, unknown>
  }>(requestHeaders, '/api/knowledge/builder/evaluation-runs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return payload.evaluationRun
}

export async function rateKnowledgeBuilderEvaluationResult(
  requestHeaders: HeadersInit | Headers,
  input: {
    resultId: string
    humanRating: 'pass' | 'fail' | 'needs_review'
    explanationAcceptance: 'accepted' | 'rejected' | 'needs_review'
    errorLabels?: Array<string>
    reviewerNotes?: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilderEvaluation<{
    evaluationResult: Record<string, unknown>
  }>(
    requestHeaders,
    `/api/knowledge/builder/evaluation-results/${encodeURIComponent(input.resultId)}/rating`,
    {
      method: 'POST',
      body: JSON.stringify({
        humanRating: input.humanRating,
        explanationAcceptance: input.explanationAcceptance,
        errorLabels: input.errorLabels ?? [],
        reviewerNotes: input.reviewerNotes,
      }),
    },
  )
  return payload.evaluationResult
}
