import type {
  ActiveFunction,
  KnowledgeWorkbenchContext,
  UserIntent,
} from '@/contracts/knowledge-workbench'

import type {
  StudioMode,
  StudioIdentity,
} from '@/stores/contextgraph-studio-store'

/**
 * Studio-side projection of the unified right-chat context.
 *
 * This is the only allowed writer of `KnowledgeWorkbenchContext` for the
 * Studio. The mode projection contract is frozen in plan §19.1.
 *
 * | Mode      | Context fields                                                  |
 * | --------- | --------------------------------------------------------------- |
 * | Sources   | activeSourceIdentityRef + sourceAnchors when selected           |
 * | Extract   | activeSourceIdentityRef + extractionRunId + selectedCandidateId |
 * | Ground    | activeSourceIdentityRef + selectedCandidateId + selectedEvidenceRefs + graph identity when available |
 * | Graph     | graph identity + selectedNodeIds/selectedEdgeIds + selectedEvidenceRefs + source identity |
 * | Compare   | active comparison-side graph identity                           |
 * | Evaluate  | evaluation target graph identity + runMode/governance state     |
 */

export type StudioWorkbenchContextInput = {
  mode: StudioMode
  identity: StudioIdentity | null
  sourceIdentityRef: string | null
  extractionRunId: string | null
  selectedCandidateId: string | null
  selectedEvidenceRefs: string[]
  selectedEvidenceRef?: string | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  mvlSummary: {
    v0RunRef: string | null
    v1RunRef: string | null
    learningDecision: 'GO' | 'STOP_REVISE' | 'SPLIT_FIX' | null
    evaluationRunId: string | null
  }
  findingContext?: {
    targetEvidenceRef?: string | null
    activeRuleVersionId?: string | null
    graphRuleId?: string | null
    originEvidenceRef?: string | null
  } | null
}

const ACTIVE_FUNCTIONS: Record<StudioMode, ActiveFunction['function']> = {
  sources: 'source_registration',
  extract: 'candidate_extraction',
  ground: 'human_grounding',
  graph: 'graph_exploration',
  inspect: 'tender_inspection',
  compare: 'release_comparison',
  evaluate: 'evaluation',
}

function deriveActiveFunction(mode: StudioMode): ActiveFunction {
  return {
    surface: 'contextgraph-studio',
    function: ACTIVE_FUNCTIONS[mode],
    tab: mode,
  }
}

function deriveUserIntent(input: {
  mode: StudioMode
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedCandidateId: string | null
  selectedEvidenceRef: string | null
}): UserIntent {
  if (input.selectedEvidenceRef) {
    return {
      kind: 'trace_evidence',
      source: 'web_ui',
      explicitness: 'implicit',
      targetType: 'evidence',
      targetIds: [input.selectedEvidenceRef],
    }
  }
  if (input.selectedCandidateId) {
    return {
      kind: 'review_candidate',
      source: 'web_ui',
      explicitness: 'implicit',
      targetType: 'candidate',
      targetIds: [input.selectedCandidateId],
    }
  }
  if (input.selectedNodeId || input.selectedEdgeId) {
    return {
      kind: 'inspect_selection',
      source: 'web_ui',
      explicitness: 'implicit',
      targetType: input.selectedNodeId ? 'node' : 'edge',
      targetIds: [input.selectedNodeId ?? input.selectedEdgeId!],
    }
  }

  const modeIntent: Record<StudioMode, UserIntent['kind']> = {
    sources: 'open_function',
    extract: 'open_function',
    ground: 'open_function',
    graph: 'open_function',
    inspect: 'inspect_finding',
    compare: 'compare_releases',
    evaluate: 'evaluate_graph',
  }
  return {
    kind: modeIntent[input.mode],
    source: 'navigation',
    explicitness: 'implicit',
    targetType: null,
    targetIds: [],
  }
}

export function projectStudioWorkbenchContext(
  input: StudioWorkbenchContextInput,
): KnowledgeWorkbenchContext {
  const {
    mode,
    identity,
    sourceIdentityRef,
    extractionRunId,
    selectedCandidateId,
    selectedEvidenceRefs,
    selectedEvidenceRef,
    selectedNodeId,
    selectedEdgeId,
    mvlSummary,
    findingContext,
  } = input

  const graphIdentityAvailable = identity !== null

  // runMode is restricted by the contract to either 'evaluation_baseline' or
  // 'authoritative'. The Studio restricts 'authoritative' to mode==='graph'
  // and 'evaluation_baseline' to mode==='evaluate'; other modes pass null.
  const runMode: KnowledgeWorkbenchContext['runMode'] =
    mode === 'evaluate'
      ? 'evaluation_baseline'
      : mode === 'graph' && identity?.authorityState === 'authoritative'
        ? 'authoritative'
        : null

  // governanceState has six valid values; the Studio always surfaces
  // 'candidate' for non-authoritative graphs and 'active' for authoritative
  // graphs (mapping "authoritative" authority -> "active" governance).
  const governanceState: KnowledgeWorkbenchContext['governanceState'] =
    identity?.authorityState === 'authoritative' ? 'active' : 'candidate'

  const baseContext: KnowledgeWorkbenchContext = {
    schemaVersion: 'knowledge_workbench_context.v2',
    activeFunction: deriveActiveFunction(mode),
    userIntent: deriveUserIntent({
      mode,
      selectedNodeId,
      selectedEdgeId,
      selectedCandidateId,
      selectedEvidenceRef: selectedEvidenceRef ?? null,
    }),
    graphRef: identity?.graphRef ?? null,
    graphVersion: identity?.graphVersion ?? null,
    graphHash: identity?.graphHash ?? null,
    authorityState: identity?.authorityState ?? 'candidate',
    runMode,
    candidateGraphId:
      identity?.authorityState === 'candidate'
        ? (identity?.graphRef ?? null)
        : null,
    acceptedReleaseId:
      identity?.authorityState === 'authoritative'
        ? (identity?.graphRef ?? null)
        : null,
    acceptedReleaseVersion:
      identity?.authorityState === 'authoritative'
        ? (identity?.graphVersion ?? null)
        : null,
    selectedNodeIds:
      mode === 'graph' || mode === 'compare'
        ? selectedNodeId
          ? [selectedNodeId]
          : []
        : [],
    selectedEdgeIds:
      mode === 'graph' || mode === 'compare'
        ? selectedEdgeId
          ? [selectedEdgeId]
          : []
        : [],
    selectedRuleIds:
      (mode === 'graph' || mode === 'compare') && selectedNodeId
        ? [selectedNodeId]
        : [],
    selectedCandidateId:
      mode === 'extract' || mode === 'ground' ? selectedCandidateId : null,
    selectedEvidenceRefs: [],
    activeSourceIdentityRef:
      mode === 'sources' ||
      mode === 'extract' ||
      mode === 'ground' ||
      mode === 'graph' ||
      mode === 'compare'
        ? sourceIdentityRef
        : null,
    sourceAnchors: [],
    governanceState,
    hasAcceptedRelease: identity?.authorityState === 'authoritative',
    extractionRunId:
      mode === 'extract' || mode === 'ground' ? extractionRunId : null,
    providerRef: 'semantica',
    providerCommit: identity?.semanticaCommit ?? null,
    targetEvidenceRef: findingContext?.targetEvidenceRef ?? null,
    activeRuleVersionId: findingContext?.activeRuleVersionId ?? null,
    graphRuleId: findingContext?.graphRuleId ?? null,
    originEvidenceRef: findingContext?.originEvidenceRef ?? null,
  }

  // Evidence refs are not part of the Studio's hand-built strings — they
  // come from the canonical evidence path. We keep the parameter for API
  // stability but only carry the count as a hint, not a list of strings,
  // until the canonical evidence/grounding path returns EvidenceRef objects.
  baseContext.selectedEvidenceRefs = selectedEvidenceRefs

  // Evaluate mode also benefits from the runMode='evaluation_baseline' that
  // is set above. Compare mode is a presentation comparison and does not
  // switch runMode (it stays null per contract).
  if (
    mode === 'evaluate' &&
    mvlSummary.evaluationRunId &&
    graphIdentityAvailable
  ) {
    baseContext.runMode = 'evaluation_baseline'
  }

  return baseContext
}
