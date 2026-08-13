export type GraphLens =
  | 'overview'
  | 'evidence'
  | 'sensitivity'
  | 'authority'
  | 'conflict'
  | 'lineage'
  | 'replay'
  | 'impact'
  | 'governance'

export type GovernanceState =
  | 'candidate'
  | 'validated'
  | 'approved'
  | 'active'
  | 'deprecated'
  | 'rejected'

export type GraphObjectCapability =
  | 'view'
  | 'inspect_evidence'
  | 'inspect_authority'
  | 'trace_lineage'
  | 'trace_impact'
  | 'compare'
  | 'export_evidence'
  | 'validate'
  | 'approve'
  | 'activate'
  | 'reject'
  | 'deprecate'
  | 'escalate'
  | 'propose_supersession'
  | 'request_source_correction'

export type GraphNode = {
  id: string
  kind: string
  label: string
  summary: string
  governanceState: GovernanceState
  semanticTier: string
  authorityRole: string
  jurisdiction: string
  effectiveFrom?: string
  effectiveTo?: string
  contextualOnly?: boolean
  sourceLocator?: string
  sourceTitle?: string
  sourceHash?: string
  localSpanHash?: string
  detailRef: string
  capabilities: GraphObjectCapability[]
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  predicate: string
  predicateLabel: string
  predicateDescription: string
  direction: 'forward' | 'reverse' | 'bidirectional'
  governanceState: GovernanceState
  semanticTier: string
  authorityRole: string
  contextualOnly?: boolean
  detailRef: string
  capabilities: GraphObjectCapability[]
}

export type GraphScene = {
  id: string
  lens: GraphLens
  title: string
  description: string
  layoutProfile:
    | 'evidence_chain'
    | 'authority_hierarchy'
    | 'conflict_comparison'
    | 'lineage'
    | 'impact_neighborhood'
    | 'replay_chain'
  focusNodeId: string
  nodeIds: string[]
  edgeIds: string[]
}

export type GraphFreshnessStatus =
  | 'fresh'
  | 'stale'
  | 'indexing'
  | 'failed_retryable'
  | 'failed_terminal'

export type GovernedGraphProjection = {
  projectionId: string
  asOf: string
  authorizationContextRef: string
  graphSnapshotRef: string
  semanticProjectionHash: string
  presentationHash: string
  freshness: {
    status: GraphFreshnessStatus
    sourceRef: string
    message: string
  }
  warnings: { code: string; message: string }[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  scenes: GraphScene[]
  omission: {
    hiddenNodeCount: number
    hiddenEdgeCount: number
    minimizedLabelCount: number
  }
  conflicts: GraphConflict[]
  impacts: GraphImpactGroup[]
  events: GraphGovernanceEvent[]
}

export type GraphConflict = {
  id: string
  type: 'precedence' | 'temporal' | 'jurisdictional' | 'semantic'
  leftNodeId: string
  rightNodeId: string
  status: 'unresolved' | 'resolved'
  resolverRationale: string
  requiredApproverRoles: string[]
  affectedArtifacts: string[]
}

export type GraphImpactGroup = {
  artifactType: string
  activeCount: number
  historicalCount: number
  incomplete: boolean
  pathSummary: string
}

export type GraphGovernanceEvent = {
  id: string
  objectRef: string
  action: string
  actorRole: string
  occurredAt: string
  eventHash: string
}

export type GraphSelection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }

export type GovernedGraphDeepLink = {
  lens?: GraphLens
  nodeId?: string
  assertionId?: string
  sourceRef?: string
  graphSnapshotRef?: string
  asOf?: string
  candidateId?: string
}
