import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'

export type KnowledgeBuilderState =
  | 'DISCOVERED'
  | 'CURATED'
  | 'PROPOSED'
  | 'APPROVED'
  | 'ACTIVATED'
  | 'REJECTED'

export type KnowledgeBuilderGraph = {
  run: Record<string, unknown>
  source: Record<string, unknown>
  nodes: Array<Record<string, unknown> & { node_id: string; label: string; governance_state: KnowledgeBuilderState }>
  relations: Array<Record<string, unknown> & { relation_id: string; relation_type: string; governance_state: KnowledgeBuilderState }>
  notes: Array<Record<string, unknown> & { note_id: string; note_text: string; governance_state: KnowledgeBuilderState }>
  clusters: Array<Record<string, unknown> & { cluster_id: string; cluster_label: string; governance_state: KnowledgeBuilderState }>
  anchors: Array<Record<string, unknown>>
  authority_notice: string
}

export const KNOWLEDGE_BUILDER_RELATION_TYPES = [
  'synonym_of',
  'variant_of',
  'projects_to',
  'not_same_as',
  'allowed_context_for',
  'prohibited_context_for',
  'exception_to',
  'conflicts_with',
] as const

export type KnowledgeBuilderRelationType =
  (typeof KNOWLEDGE_BUILDER_RELATION_TYPES)[number]

async function requestKnowledgeBuilder<T>(
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
      String(payload.detail || payload.error || `knowledge-builder-${response.status}`),
    )
  }
  return payload
}

export async function createKnowledgeBuilderDiscoveryRun(
  requestHeaders: HeadersInit | Headers,
  input: {
    sourceKind?: 'folder' | 'file' | 'text'
    sourceRef?: string
    sourceText: string
    sourceMetadata?: Record<string, unknown>
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ run: Record<string, unknown> }>(
    requestHeaders,
    '/api/knowledge/builder/discovery-runs',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return payload.run
}

export async function getKnowledgeBuilderGraph(
  requestHeaders: HeadersInit | Headers,
  runId: string,
): Promise<KnowledgeBuilderGraph> {
  const payload = await requestKnowledgeBuilder<{ graph: KnowledgeBuilderGraph }>(
    requestHeaders,
    `/api/knowledge/builder/discovery-runs/${encodeURIComponent(runId)}/graph`,
  )
  return payload.graph
}

export async function getKnowledgeBuilderCandidateExplanation(
  requestHeaders: HeadersInit | Headers,
  candidateId: string,
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ explanation: Record<string, unknown> }>(
    requestHeaders,
    `/api/knowledge/builder/candidates/${encodeURIComponent(candidateId)}/explanation`,
  )
  return payload.explanation
}

export async function curateKnowledgeBuilderRelation(
  requestHeaders: HeadersInit | Headers,
  input: {
    relationId: string
    decision: 'accept' | 'reject' | 'change'
    relationType: KnowledgeBuilderRelationType
    reviewerNotes?: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{
    relationCandidate: Record<string, unknown>
  }>(
    requestHeaders,
    `/api/knowledge/builder/relations/${encodeURIComponent(input.relationId)}/curation`,
    {
      method: 'POST',
      body: JSON.stringify({
        decision: input.decision,
        relationType: input.relationType,
        reviewerNotes: input.reviewerNotes,
      }),
    },
  )
  return payload.relationCandidate
}

export async function splitKnowledgeBuilderCluster(
  requestHeaders: HeadersInit | Headers,
  input: { clusterId: string; nodeIds: Array<string>; reviewerNotes?: string },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ curationEvent: Record<string, unknown> }>(
    requestHeaders,
    `/api/knowledge/builder/clusters/${encodeURIComponent(input.clusterId)}/split`,
    {
      method: 'POST',
      body: JSON.stringify({
        nodeIds: input.nodeIds,
        reviewerNotes: input.reviewerNotes,
      }),
    },
  )
  return payload.curationEvent
}

export async function mergeKnowledgeBuilderClusters(
  requestHeaders: HeadersInit | Headers,
  input: { clusterIds: Array<string>; reviewerNotes?: string },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ curationEvent: Record<string, unknown> }>(
    requestHeaders,
    '/api/knowledge/builder/clusters/merge',
    {
      method: 'POST',
      body: JSON.stringify({
        clusterIds: input.clusterIds,
        reviewerNotes: input.reviewerNotes,
      }),
    },
  )
  return payload.curationEvent
}

export async function createCanonicalTermCandidate(
  requestHeaders: HeadersInit | Headers,
  input: {
    discoveryRunId: string
    domain: string
    canonicalLabel: string
    definition: string
    aliases: Array<string>
    allowedContexts: Array<string>
    prohibitedContexts: Array<string>
    sourceAnchorRefs: Array<string>
    evidenceSummary: string
    proposedRuntimeEffect: Record<string, unknown>
    governanceState?: 'CURATED' | 'PROPOSED'
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ termCandidate: Record<string, unknown> }>(
    requestHeaders,
    '/api/knowledge/builder/canonical-terms',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return payload.termCandidate
}

export async function promoteKnowledgeBuilderRuntimeSemantics(
  requestHeaders: HeadersInit | Headers,
  input: {
    termCandidateId: string
    semanticRelationCandidateIds: Array<string>
    evaluationRunId: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{
    authorityVersion: Record<string, unknown>
  }>(requestHeaders, '/api/knowledge/builder/promotions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return payload.authorityVersion
}

export async function rebuildKnowledgeBuilderReadModels(
  requestHeaders: HeadersInit | Headers,
  input: { authorityVersionId: string },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{
    readModelRebuild: Record<string, unknown>
  }>(requestHeaders, '/api/knowledge/builder/read-model-rebuilds', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return payload.readModelRebuild
}

export async function getKnowledgeBuilderRuntimeSemanticIndex(
  requestHeaders: HeadersInit | Headers,
  authorityVersionId: string,
): Promise<Record<string, unknown>> {
  return requestKnowledgeBuilder<Record<string, unknown>>(
    requestHeaders,
    `/api/knowledge/builder/runtime-semantic-index/${encodeURIComponent(authorityVersionId)}`,
  )
}

export async function listKnowledgeBuilderFeedbackDeltas(
  requestHeaders: HeadersInit | Headers,
  discoveryRunId?: string,
): Promise<Array<Record<string, unknown>>> {
  const query = discoveryRunId
    ? `?discoveryRunId=${encodeURIComponent(discoveryRunId)}`
    : ''
  const payload = await requestKnowledgeBuilder<{
    feedbackDeltas: Array<Record<string, unknown>>
  }>(requestHeaders, `/api/knowledge/builder/feedback-deltas${query}`)
  return payload.feedbackDeltas
}

export function isKnowledgeBuilderRuntimeAuthority(state: KnowledgeBuilderState): boolean {
  return state === 'ACTIVATED'
}
