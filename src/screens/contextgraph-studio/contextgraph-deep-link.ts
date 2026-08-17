/**
 * ContextGraph Studio deep-link helper (CF-E25).
 *
 * Studio supports deep-linking back into a specific mode/selection via
 * the route query string.  The hint values are validated against the
 * currently loaded canonical snapshot before being applied; invalid or
 * stale IDs are rejected rather than silently applied.
 *
 * Supported query shapes (from the plan §19.3.4 deep-link contract):
 *
 *   /contextgraph-studio?mode=ground&candidate_id=...&evidence_ref=...
 *   /contextgraph-studio?mode=graph&graph_ref=...&graph_version=...&node_id=...&edge_id=...
 *   /contextgraph-studio?mode=compare&v0_run_ref=...&v1_run_ref=...&assertion_id=...
 *   /contextgraph-studio?mode=evaluate&evaluation_run_id=...
 */

import type { StudioIdentity } from '@/stores/contextgraph-studio-store'
import type { StudioMode } from '@/stores/contextgraph-studio-store'

export type DeepLinkSelection = {
  mode: StudioMode
  graphRef?: string
  graphVersion?: string
  nodeId?: string
  edgeId?: string
  candidateId?: string
  evidenceRef?: string
  v0RunRef?: string
  v1RunRef?: string
  assertionId?: string
  evaluationRunId?: string
  tenderRunId?: string
  findingId?: string
}

const ALLOWED_MODES: ReadonlySet<StudioMode> = new Set([
  'sources',
  'extract',
  'ground',
  'graph',
  'inspect',
  'compare',
  'evaluate',
])

/**
 * Parse a URL search params object into a typed deep-link selection.
 * Returns `null` when the URL carries no Studio deep-link or when the
 * `mode` value is invalid.
 */
export function parseDeepLinkFromSearchParams(
  params: URLSearchParams,
): DeepLinkSelection | null {
  const rawMode = params.get('mode')
  if (!rawMode) return null
  if (!ALLOWED_MODES.has(rawMode as StudioMode)) return null

  const pick = (key: string): string | undefined => {
    const value = params.get(key)
    return value && value.length > 0 ? value : undefined
  }

  return {
    mode: rawMode as StudioMode,
    graphRef: pick('graph_ref'),
    graphVersion: pick('graph_version'),
    nodeId: pick('node_id'),
    edgeId: pick('edge_id'),
    candidateId: pick('candidate_id'),
    evidenceRef: pick('evidence_ref'),
    v0RunRef: pick('v0_run_ref'),
    v1RunRef: pick('v1_run_ref'),
    assertionId: pick('assertion_id'),
    evaluationRunId: pick('evaluation_run_id'),
    tenderRunId: pick('tender_run_id'),
    findingId: pick('finding_id'),
  }
}

/**
 * Validate a deep-link selection against the canonical runtime identity
 * and the loaded view model.
 *
 * Returns the validated selection (with stale IDs stripped) when it can
 * be applied, or `null` when the link targets an unknown graph /
 * evidence / candidate and must be rejected rather than silently
 * applied.
 */
export function validateDeepLinkAgainstIdentity(
  link: DeepLinkSelection,
  identity: StudioIdentity | null,
  viewModel: { nodes: ReadonlyArray<{ id: string }>; edges: ReadonlyArray<{ id: string }> } | null,
  mvlSummary: {
    v0RunRef: string | null
    v1RunRef: string | null
    evaluationRunId: string | null
  },
): DeepLinkSelection | null {
  // Graph/compare/evaluate deep-links require canonical identity.
  if (link.mode === 'graph' || link.mode === 'compare' || link.mode === 'evaluate') {
    if (!identity) return null
    if (link.graphRef && link.graphRef !== identity.graphRef) return null
    if (link.graphVersion && link.graphVersion !== identity.graphVersion) return null
  }

  // Compare/Evaluate links reference V0/V1 run refs and the evaluation
  // run id; reject when those do not match the persisted MVL summary.
  if (link.mode === 'compare') {
    if (link.v0RunRef && link.v0RunRef !== mvlSummary.v0RunRef) return null
    if (link.v1RunRef && link.v1RunRef !== mvlSummary.v1RunRef) return null
  }
  if (link.mode === 'evaluate') {
    if (
      link.evaluationRunId &&
      link.evaluationRunId !== mvlSummary.evaluationRunId
    ) {
      return null
    }
  }

  // Node/edge ids must resolve against the currently loaded view model.
  if (link.nodeId && viewModel) {
    if (!viewModel.nodes.some((node) => node.id === link.nodeId)) return null
  }
  if (link.edgeId && viewModel) {
    if (!viewModel.edges.some((edge) => edge.id === link.edgeId)) return null
  }

  // Strip stale identity/ID hints so consumers see only the validated ones.
  return {
    mode: link.mode,
    graphRef: link.graphRef,
    graphVersion: link.graphVersion,
    nodeId: link.nodeId,
    edgeId: link.edgeId,
    candidateId: link.candidateId,
    evidenceRef: link.evidenceRef,
    v0RunRef: link.v0RunRef,
    v1RunRef: link.v1RunRef,
    assertionId: link.assertionId,
    evaluationRunId: link.evaluationRunId,
    tenderRunId: link.tenderRunId,
    findingId: link.findingId,
  }
}

/**
 * Build a deep-link search string from a deep-link selection.  Used by
 * the Studio modes when they want to surface a shareable URL.
 */
export function buildDeepLinkSearchParams(link: DeepLinkSelection): string {
  const params = new URLSearchParams()
  params.set('mode', link.mode)
  if (link.graphRef) params.set('graph_ref', link.graphRef)
  if (link.graphVersion) params.set('graph_version', link.graphVersion)
  if (link.nodeId) params.set('node_id', link.nodeId)
  if (link.edgeId) params.set('edge_id', link.edgeId)
  if (link.candidateId) params.set('candidate_id', link.candidateId)
  if (link.evidenceRef) params.set('evidence_ref', link.evidenceRef)
  if (link.v0RunRef) params.set('v0_run_ref', link.v0RunRef)
  if (link.v1RunRef) params.set('v1_run_ref', link.v1RunRef)
  if (link.assertionId) params.set('assertion_id', link.assertionId)
  if (link.evaluationRunId) params.set('evaluation_run_id', link.evaluationRunId)
  if (link.tenderRunId) params.set('tender_run_id', link.tenderRunId)
  if (link.findingId) params.set('finding_id', link.findingId)
  return params.toString()
}
