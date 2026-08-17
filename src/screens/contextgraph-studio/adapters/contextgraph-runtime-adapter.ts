import { z } from 'zod'

import {
  GraphViewModelSchema,
  type GraphViewModel,
} from '@/contracts/graph-view-model'
import {
  ContextGraphRuntimeProjectionV1Schema,
  type ContextGraphRuntimeProjectionV1,
} from '@/contracts/contextgraph-runtime'

/**
 * Adapter contract (frozen):
 *
 *   browser node.id              -> GraphViewModel node.id
 *   browser node.type            -> node.semanticType
 *   browser node.content         -> node.label
 *   browser node.sourceAnchors   -> canonical source-anchor collection
 *   browser edge.id              -> edge.id
 *   browser edge.source          -> edge.sourceId
 *   browser edge.target          -> edge.targetId
 *   browser edge.type            -> edge.relationshipType
 *   browser edge.weight          -> edge.weight
 *   browser edge.properties      -> edge.properties
 *
 * Identity rules:
 *
 *   if authorityState == candidate:
 *     candidateGraphId = graphRef
 *     acceptedReleaseId = null
 *
 *   if authorityState == authoritative:
 *     candidateGraphId = null
 *     acceptedReleaseId = graphRef
 *
 * EvidenceRefs are copied only from the transport's canonical evidence
 * collection; the adapter never derives them from browser coordinates.
 */
export function adaptContextGraphRuntimeProjection(
  transport: unknown,
): GraphViewModel {
  const parsed = ContextGraphRuntimeProjectionV1Schema.parse(transport)

  const candidateGraphId = parsed.candidateGraphId ?? (parsed.authorityState === 'candidate' ? parsed.graphRef : null)
  const acceptedReleaseId = parsed.acceptedReleaseId ?? (parsed.authorityState === 'authoritative' ? parsed.graphRef : null)

  const viewModel = GraphViewModelSchema.parse({
    schemaVersion: 'semantier.graph_view_model.v2',
    graphRef: parsed.graphRef,
    graphVersion: parsed.graphVersion,
    graphHash: parsed.graphHash,
    authorityState: parsed.authorityState,
    candidateGraphId,
    acceptedReleaseId,
    nodes: parsed.nodes.map((node) => ({
      id: node.id,
      semanticType: node.type,
      label: node.content,
      properties: node.properties ?? {},
      sourceAnchors: node.sourceAnchors ?? [],
      evidenceRefs: node.evidenceRefs ?? [],
      evidenceRefDetails: node.evidenceRefDetails ?? [],
      groundingState: node.groundingState,
      lineage: node.lineage ?? { sourceIdentityRefs: [], extractionRunRef: null, candidateGraphId, acceptedReleaseId, acceptedReleaseVersion: parsed.authorityState === 'authoritative' ? parsed.graphVersion : null },
    })),
    edges: parsed.edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      relationshipType: edge.type,
      weight: edge.weight,
      properties: edge.properties ?? {},
      sourceAnchors: edge.sourceAnchors ?? [],
      evidenceRefs: edge.evidenceRefs ?? [],
      evidenceRefDetails: edge.evidenceRefDetails ?? [],
      groundingState: edge.groundingState,
      lineage: edge.lineage ?? { sourceIdentityRefs: [], extractionRunRef: null, candidateGraphId, acceptedReleaseId, acceptedReleaseVersion: parsed.authorityState === 'authoritative' ? parsed.graphVersion : null },
    })),
    sourceAnchors: parsed.sourceAnchors,
    sourceEvidenceRefs: parsed.sourceEvidenceRefs ?? [],
  })

  return viewModel
}

/**
 * Defensive helper that produces a parsed projection without throwing.
 * Used by Suspense/error boundaries so the Studio can degrade gracefully
 * to a fallback identity rather than crashing the entire route.
 */
export function tryAdaptContextGraphRuntimeProjection(
  transport: unknown,
):
  | { ok: true; viewModel: GraphViewModel }
  | { ok: false; error: z.ZodError } {
  const result = ContextGraphRuntimeProjectionV1Schema.safeParse(transport)
  if (!result.success) return { ok: false, error: result.error }
  return { ok: true, viewModel: adaptContextGraphRuntimeProjection(result.data) }
}

/**
 * Fetch the canonical runtime projection from the server and adapt it
 * into a parsed `GraphViewModel.v2` snapshot.
 *
 * This is the only allowed entry point from the Studio screen — the
 * screen never reads raw `response.json()` directly so the renderer
 * cannot accidentally bypass the adapter (CF-E03).
 *
 * Returns `{ ok: false }` when the transport is missing required
 * identity, the server returned an HTTP error, the body failed Zod
 * validation, or the network call rejected.
 */
export type RuntimeFetchResult =
  | { ok: true; viewModel: GraphViewModel }
  | { ok: false; error: 'http_error' | 'invalid_transport' | 'network_error' }

export async function fetchAndAdaptRuntimeProjection(
  fetchImpl: typeof fetch = fetch,
  endpoint: string = '/api/contextgraph/runtime',
): Promise<RuntimeFetchResult> {
  let response: Response
  try {
    response = await fetchImpl(endpoint)
  } catch {
    return { ok: false, error: 'network_error' }
  }
  if (!response.ok) return { ok: false, error: 'http_error' }

  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    return { ok: false, error: 'invalid_transport' }
  }

  const adapted = tryAdaptContextGraphRuntimeProjection(raw)
  if (!adapted.ok) return { ok: false, error: 'invalid_transport' }
  return { ok: true, viewModel: adapted.viewModel }
}

/** Resolve the selected canonical EvidenceRef through the R2 server seam. */
export async function resolveEvidenceRef(
  evidenceRef: string,
  evidenceRefPayload?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return fetchImpl('/api/evidence/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evidence_ref: evidenceRefPayload ?? { evidenceRef } }),
  })
}

export type ContextGraphRuntimeAdapter = {
  adapt: (transport: unknown) => GraphViewModel
  tryAdapt: (
    transport: unknown,
  ) => { ok: true; viewModel: GraphViewModel } | { ok: false; error: z.ZodError }
}

export function createContextGraphRuntimeAdapter(): ContextGraphRuntimeAdapter {
  return {
    adapt: adaptContextGraphRuntimeProjection,
    tryAdapt: tryAdaptContextGraphRuntimeProjection,
  }
}

/**
 * Re-exported types so consumers can pull all runtime-typing from a single
 * Studio-side import surface.
 */
export type {
  GraphViewModel,
  ContextGraphRuntimeProjectionV1,
}
