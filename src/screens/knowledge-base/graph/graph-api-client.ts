import type {
  GovernedGraphDeepLink,
  GovernedGraphProjection,
  GraphLens,
  GraphObjectCapability,
  GraphScene,
} from './graph-types'

const GOVERNED_GRAPH_API_PREFIX = '/api/semantier-proxy/api/governed-graph'

export async function resolveGovernedGraphProjection(
  deepLink: GovernedGraphDeepLink,
  entryLens: GraphLens,
): Promise<GovernedGraphProjection> {
  const lens = deepLink.lens ?? entryLens
  if (!deepLink.sourceRef && !deepLink.nodeId && !deepLink.assertionId && !deepLink.graphSnapshotRef) {
    return fixtureGovernedGraphProjection(lens)
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(`${GOVERNED_GRAPH_API_PREFIX}/projections/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contract_version: 'governed_graph_contract.v1',
        source_ref: deepLink.sourceRef,
        focus_object_ref: deepLink.nodeId ?? deepLink.assertionId,
        lens,
        graph_snapshot_ref: deepLink.graphSnapshotRef,
        as_of: deepLink.asOf,
      }),
    })

    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      return normalizeGovernedGraphProjection(await response.json())
    }
  } catch {
    return fixtureGovernedGraphProjection(lens)
  } finally {
    window.clearTimeout(timeout)
  }

  return fixtureGovernedGraphProjection(lens)
}

export async function submitGovernanceCommand(input: {
  projectionId: string
  objectRef: string
  action: string
  expectedGraphSnapshotRef: string
  justification: string
}) {
  const response = await fetch(`${GOVERNED_GRAPH_API_PREFIX}/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contract_version: 'governed_graph_contract.v1',
      projection_id: input.projectionId,
      object_ref: input.objectRef,
      action: input.action,
      expected_graph_snapshot_ref: input.expectedGraphSnapshotRef,
      justification: input.justification,
      idempotency_key: `${input.projectionId}:${input.objectRef}:${input.action}`,
    }),
  })

  if (!response.ok) {
    throw new Error('governance_command_failed')
  }
  return response.json()
}

const KNOWLEDGE_BUILDER_PREFIX = '/api/semantier-proxy/api/knowledge/builder'

export async function submitSemanticaGrounding(input: {
  assertionId: string
  decision: 'accept' | 'reject' | 'edit'
  justification: string
}) {
  const response = await fetch(
    `${KNOWLEDGE_BUILDER_PREFIX}/assertion-candidates/${encodeURIComponent(input.assertionId)}/grounding-events`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'learning_event_grounding_request.v1',
        decision: input.decision,
        certainty: 'high',
        reasonCode: input.decision === 'accept' ? 'confirmed' : 'reviewer_decision',
        justification: input.justification,
      }),
    },
  )
  if (!response.ok) throw new Error('semantica_grounding_failed')
  return response.json() as Promise<{ learningEvent: { event_id: string } }>
}

export async function materializeSemanticaRelease(input: {
  assertionId: string
  humanEventId: string
}) {
  const response = await fetch(
    `${KNOWLEDGE_BUILDER_PREFIX}/assertion-candidates/${encodeURIComponent(input.assertionId)}/release`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'accepted_graph_release_request.v1',
        humanEventId: input.humanEventId,
      }),
    },
  )
  if (!response.ok) throw new Error('semantica_release_failed')
  return response.json()
}

type RawRecord = Record<string, unknown>

export function normalizeGovernedGraphProjection(
  payload: unknown,
): GovernedGraphProjection {
  if (!isRecord(payload)) return fixtureGovernedGraphProjection()
  if ('projectionId' in payload) return payload as GovernedGraphProjection

  const nodes = arrayOfRecords(payload.nodes).map((node) => ({
    id: text(node.node_id),
    kind: text(node.node_kind, 'entity'),
    label: text(node.label, text(node.node_id)),
    summary: text(node.display_summary),
    governanceState: text(node.governance_state, 'candidate') as GovernedGraphProjection['nodes'][number]['governanceState'],
    semanticTier: text(node.semantic_tier, 'T3'),
    authorityRole: text(node.authority_role, 'structural'),
    jurisdiction: text(node.jurisdiction),
    effectiveFrom: optionalText(node.effective_from),
    effectiveTo: optionalText(node.effective_to),
    contextualOnly: Boolean(node.contextual_only),
    sourceLocator: optionalText(first(arrayOfStrings(node.source_anchor_refs))),
    sourceTitle: optionalText(node.metadata, 'canonical_key'),
    sourceHash: undefined,
    localSpanHash: undefined,
    detailRef: text(node.detail_ref, `node:${text(node.node_id)}`),
    capabilities: arrayOfStrings(node.capabilities) as GraphObjectCapability[],
  }))

  const edges = arrayOfRecords(payload.edges).map((edge) => ({
    id: text(edge.edge_id),
    source: text(edge.source_node_id),
    target: text(edge.target_node_id),
    predicate: text(edge.predicate),
    predicateLabel: text(edge.predicate_label, text(edge.predicate)),
    predicateDescription: text(edge.predicate_description),
    direction: text(edge.direction, 'forward') as GovernedGraphProjection['edges'][number]['direction'],
    governanceState: text(edge.governance_state, 'candidate') as GovernedGraphProjection['edges'][number]['governanceState'],
    semanticTier: text(edge.semantic_tier, 'T3'),
    authorityRole: text(edge.authority_role, 'structural'),
    contextualOnly: Boolean(edge.contextual_only),
    detailRef: text(edge.detail_ref, `assertion:${text(edge.edge_id)}`),
    capabilities: arrayOfStrings(edge.capabilities) as GraphObjectCapability[],
  }))

  const scenes = arrayOfRecords(payload.scenes).map(
    (scene): GraphScene => ({
      id: text(scene.scene_id),
      lens: text(scene.lens, 'overview') as GraphLens,
      title: text(scene.title),
      description: text(scene.description),
      layoutProfile: text(scene.layout_profile, 'evidence_chain') as GraphScene['layoutProfile'],
      focusNodeId: text(scene.focus_node_id),
      nodeIds: arrayOfStrings(scene.node_ids),
      edgeIds: arrayOfStrings(scene.edge_ids),
    }),
  )
  const manifest = isRecord(payload.redaction_manifest)
    ? payload.redaction_manifest
    : {}
  const freshness = isRecord(payload.freshness) ? payload.freshness : {}

  return {
    projectionId: text(payload.projection_id),
    asOf: text(payload.as_of),
    authorizationContextRef: text(payload.authorization_context_ref),
    graphSnapshotRef: optionalText(payload.graph_snapshot_ref) ?? '',
    semanticProjectionHash: text(payload.projection_hash),
    presentationHash: text(payload.presentation_hash),
    freshness: {
      status: text(freshness.status, 'stale') as GovernedGraphProjection['freshness']['status'],
      sourceRef: text(freshness.source_ref),
      message: text(freshness.message),
    },
    warnings: arrayOfRecords(payload.warnings).map((warning) => ({
      code: text(warning.code),
      message: text(warning.message),
    })),
    nodes,
    edges,
    scenes: scenes.length > 0 ? scenes : fixtureGovernedGraphProjection().scenes,
    omission: {
      hiddenNodeCount: numberValue(manifest.omitted_node_count),
      hiddenEdgeCount: numberValue(manifest.omitted_edge_count),
      minimizedLabelCount: numberValue(manifest.minimized_node_count),
    },
    conflicts: [],
    impacts: [],
    events: [],
  }
}

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function arrayOfRecords(value: unknown): RawRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : []
}

function text(value: unknown, fallback = ''): string {
  return value === null || value === undefined ? fallback : String(value)
}

function optionalText(value: unknown, key?: string): string | undefined {
  const target = key && isRecord(value) ? value[key] : value
  if (target === null || target === undefined || target === '') return undefined
  return String(target)
}

function first(values: string[]): string | undefined {
  return values[0]
}

function numberValue(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function fixtureGovernedGraphProjection(
  lens: GraphLens = 'evidence',
): GovernedGraphProjection {
  return {
    projectionId: 'proj_tender_clause_4_2',
    asOf: '2026-07-30T00:00:00.000Z',
    authorizationContextRef: 'authz_ctx_workspace_member',
    graphSnapshotRef: 'kg_snapshot_2026_07_30_a',
    semanticProjectionHash: 'sem_hash_visible_authority_chain',
    presentationHash: 'pres_hash_evidence_layout_v1',
    freshness: {
      status: 'fresh',
      sourceRef: 'source:tender:demo',
      message: 'Current governed graph snapshot',
    },
    warnings: [
      {
        code: 'authorized_omission_summary',
        message: 'Some evidence was minimized by disclosure policy.',
      },
    ],
    omission: {
      hiddenNodeCount: 3,
      hiddenEdgeCount: 1,
      minimizedLabelCount: 2,
    },
    nodes: [
      {
        id: 'source:tender:demo',
        kind: 'source',
        label: 'Tender package 2026-A',
        summary: 'Registered tender source under procurement review.',
        governanceState: 'active',
        semanticTier: 'T2',
        authorityRole: 'source_record',
        jurisdiction: 'CN',
        effectiveFrom: '2026-07-01',
        sourceLocator: 'package root',
        sourceTitle: 'Tender package 2026-A',
        sourceHash: 'sha256:src_demo',
        localSpanHash: 'sha256:root_span',
        detailRef: 'node:source:tender:demo',
        capabilities: ['view', 'inspect_evidence', 'request_source_correction'],
      },
      {
        id: 'clause:4.2',
        kind: 'source_span',
        label: 'Tender clause 4.2',
        summary: 'Bidder must hold a valid municipal construction license.',
        governanceState: 'active',
        semanticTier: 'T3',
        authorityRole: 'tender_requirement',
        jurisdiction: 'CN-SH',
        effectiveFrom: '2026-07-01',
        sourceLocator: 'Section 4, clause 4.2',
        sourceTitle: 'Tender package 2026-A',
        sourceHash: 'sha256:src_demo',
        localSpanHash: 'sha256:clause_4_2',
        detailRef: 'anchor:clause_4_2',
        capabilities: ['view', 'inspect_evidence', 'trace_impact'],
      },
      {
        id: 'assertion:qualification',
        kind: 'claim',
        label: 'Qualification requirement',
        summary: 'The tender creates a bidder qualification condition.',
        governanceState: 'candidate',
        semanticTier: 'T4',
        authorityRole: 'derived_interpretation',
        jurisdiction: 'CN-SH',
        effectiveFrom: '2026-07-01',
        sourceLocator: 'Derived from clause 4.2',
        sourceTitle: 'Tender package 2026-A',
        sourceHash: 'sha256:src_demo',
        localSpanHash: 'sha256:clause_4_2',
        detailRef: 'assertion:qualification',
        capabilities: [
          'view',
          'inspect_evidence',
          'inspect_authority',
          'trace_lineage',
          'trace_impact',
          'validate',
          'approve',
          'reject',
          'export_evidence',
        ],
      },
      {
        id: 'law:procurement:26',
        kind: 'authority',
        label: 'Implementation Regulation article 26',
        summary: 'Superior legal authority constraining qualification terms.',
        governanceState: 'active',
        semanticTier: 'T3',
        authorityRole: 'binding_authority',
        jurisdiction: 'CN',
        effectiveFrom: '2015-03-01',
        sourceLocator: 'Article 26',
        sourceTitle: 'Implementation Regulation',
        sourceHash: 'sha256:reg26',
        localSpanHash: 'sha256:article26',
        detailRef: 'anchor:article26',
        capabilities: ['view', 'inspect_evidence', 'inspect_authority'],
      },
      {
        id: 'policy:internal:v3',
        kind: 'rule',
        label: 'Internal procurement policy v3',
        summary: 'Contextual policy used for review routing, not active law.',
        governanceState: 'active',
        semanticTier: 'T4',
        authorityRole: 'contextual_policy',
        jurisdiction: 'ORG',
        effectiveFrom: '2026-01-01',
        contextualOnly: true,
        sourceLocator: 'Policy 3.1',
        sourceTitle: 'Internal procurement policy v3',
        sourceHash: 'sha256:policyv3',
        localSpanHash: 'sha256:policy31',
        detailRef: 'anchor:policy31',
        capabilities: ['view', 'inspect_authority', 'compare'],
      },
      {
        id: 'conflict:qualification-policy',
        kind: 'conflict',
        label: 'Qualification policy conflict',
        summary: 'Candidate interpretation conflicts with internal policy scope.',
        governanceState: 'candidate',
        semanticTier: 'T4',
        authorityRole: 'conflict_record',
        jurisdiction: 'ORG',
        detailRef: 'conflict:qualification-policy',
        capabilities: ['view', 'compare', 'escalate'],
      },
    ],
    edges: [
      {
        id: 'edge:source-clause',
        source: 'source:tender:demo',
        target: 'clause:4.2',
        predicate: 'contains_anchor',
        predicateLabel: 'contains clause',
        predicateDescription: 'The registered source contains this exact clause anchor.',
        direction: 'forward',
        governanceState: 'active',
        semanticTier: 'T2',
        authorityRole: 'source_structure',
        detailRef: 'edge:source-clause',
        capabilities: ['view', 'inspect_evidence'],
      },
      {
        id: 'edge:clause-assertion',
        source: 'clause:4.2',
        target: 'assertion:qualification',
        predicate: 'supports_assertion',
        predicateLabel: 'supports finding',
        predicateDescription: 'The source clause supports the bidder qualification finding.',
        direction: 'forward',
        governanceState: 'candidate',
        semanticTier: 'T4',
        authorityRole: 'evidence_support',
        detailRef: 'assertion:qualification',
        capabilities: ['view', 'inspect_evidence'],
      },
      {
        id: 'edge:assertion-authority',
        source: 'assertion:qualification',
        target: 'law:procurement:26',
        predicate: 'constrained_by',
        predicateLabel: 'constrained by',
        predicateDescription: 'The finding must be checked against superior procurement law.',
        direction: 'forward',
        governanceState: 'active',
        semanticTier: 'T3',
        authorityRole: 'binding_authority',
        detailRef: 'edge:assertion-authority',
        capabilities: ['view', 'inspect_authority'],
      },
      {
        id: 'edge:assertion-policy',
        source: 'assertion:qualification',
        target: 'policy:internal:v3',
        predicate: 'conflicts_with',
        predicateLabel: 'conflicts with',
        predicateDescription: 'The interpretation conflicts with contextual policy scope.',
        direction: 'bidirectional',
        governanceState: 'candidate',
        semanticTier: 'T4',
        authorityRole: 'contextual_policy',
        contextualOnly: true,
        detailRef: 'conflict:qualification-policy',
        capabilities: ['view', 'compare'],
      },
      {
        id: 'edge:conflict-record',
        source: 'conflict:qualification-policy',
        target: 'assertion:qualification',
        predicate: 'requires_review',
        predicateLabel: 'requires review',
        predicateDescription: 'The conflict requires compliance owner review.',
        direction: 'forward',
        governanceState: 'candidate',
        semanticTier: 'T4',
        authorityRole: 'review_gate',
        detailRef: 'conflict:qualification-policy',
        capabilities: ['view', 'escalate'],
      },
    ],
    scenes: [
      {
        id: 'scene:evidence',
        lens,
        title: 'Evidence chain',
        description: 'Source, clause anchor, finding, authority, and conflict context.',
        layoutProfile:
          lens === 'conflict'
            ? 'conflict_comparison'
            : lens === 'authority'
              ? 'authority_hierarchy'
              : lens === 'impact'
                ? 'impact_neighborhood'
                : lens === 'replay'
                  ? 'replay_chain'
                  : lens === 'lineage'
                    ? 'lineage'
                    : 'evidence_chain',
        focusNodeId: 'assertion:qualification',
        nodeIds: [
          'source:tender:demo',
          'clause:4.2',
          'assertion:qualification',
          'law:procurement:26',
          'policy:internal:v3',
          'conflict:qualification-policy',
        ],
        edgeIds: [
          'edge:source-clause',
          'edge:clause-assertion',
          'edge:assertion-authority',
          'edge:assertion-policy',
          'edge:conflict-record',
        ],
      },
    ],
    conflicts: [
      {
        id: 'conflict:qualification-policy',
        type: 'semantic',
        leftNodeId: 'assertion:qualification',
        rightNodeId: 'policy:internal:v3',
        status: 'unresolved',
        resolverRationale:
          'Policy scope is contextual-only and cannot override superior law without human review.',
        requiredApproverRoles: ['compliance_owner', 'legal_reviewer'],
        affectedArtifacts: ['tender_publication_review', 'bidder_screening'],
      },
    ],
    impacts: [
      {
        artifactType: 'Tender workflow',
        activeCount: 2,
        historicalCount: 1,
        incomplete: true,
        pathSummary:
          'Tender clause 4.2 -> qualification requirement -> bidder screening workflow',
      },
      {
        artifactType: 'Governance bundle',
        activeCount: 1,
        historicalCount: 0,
        incomplete: false,
        pathSummary:
          'Qualification requirement -> compliance-owner review -> activation bundle',
      },
    ],
    events: [
      {
        id: 'evt_extract_1',
        objectRef: 'assertion:qualification',
        action: 'candidate_extracted',
        actorRole: 'deterministic_extractor',
        occurredAt: '2026-07-30T00:00:00.000Z',
        eventHash: 'sha256:event_extract',
      },
      {
        id: 'evt_review_1',
        objectRef: 'conflict:qualification-policy',
        action: 'review_required',
        actorRole: 'resolver',
        occurredAt: '2026-07-30T00:10:00.000Z',
        eventHash: 'sha256:event_review',
      },
    ],
  }
}
