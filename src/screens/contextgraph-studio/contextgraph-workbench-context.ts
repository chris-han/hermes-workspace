import type { KnowledgeWorkbenchContext } from '@/contracts/knowledge-workbench'

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
    graphRef: identity?.graphRef ?? null,
    graphVersion: identity?.graphVersion ?? null,
    graphHash: identity?.graphHash ?? null,
    authorityState: identity?.authorityState ?? 'candidate',
    runMode,
    candidateGraphId:
      identity?.authorityState === 'candidate' ? identity?.graphRef ?? null : null,
    acceptedReleaseId:
      identity?.authorityState === 'authoritative' ? identity?.graphRef ?? null : null,
    acceptedReleaseVersion:
      identity?.authorityState === 'authoritative' ? identity?.graphVersion ?? null : null,
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
  if (mode === 'evaluate' && mvlSummary.evaluationRunId && graphIdentityAvailable) {
    baseContext.runMode = 'evaluation_baseline'
  }

  return baseContext
}

/**
 * Empty-chat suggestion prompts. Used when the right-chat sidebar is empty
 * AND the unified KnowledgeWorkbenchContext is also empty (no active source,
 * graph, or candidate). Falls back to the Demo Dataset Walkthrough set so
 * the Studio never presents an empty chat with no starter prompts.
 */
export const STUDIO_EMPTY_CHAT_PROMPTS: ReadonlyArray<string> = [
  '试用 索阳 示例公司',
  '营业分析',
  '日常入账报销',
  '报税报告生成',
  '合规报告生成',
] as const

/**
 * ContextGraph Studio-specific empty-chat prompts.
 *
 * Used when the right chat is opened while the user is on
 * `/contextgraph-studio` and the workbench context is empty.  These
 * reflect the Studio's actual workbench (Sources → Extract → Ground →
 * Graph → Inspect → Compare → Evaluate) so the user gets one-click
 * suggestions that match the surface they are looking at, instead of
 * generic demo-dataset business prompts.
 */
export const STUDIO_WORKBENCH_EMPTY_PROMPTS: ReadonlyArray<string> = [
  '上传受控知识文档并开始 Sources 流程',
  '在 Graph 模式下显示当前激活的发布版本',
  '进入 Tender Inspect 模式分析新的招标文档',
  '比较当前 V0 与 V1 候选图谱的差异',
  '运行评估并显示 GO / STOP_REVISE / SPLIT_FIX 决策',
] as const

export const STUDIO_WORKBENCH_EMPTY_PROMPTS_EN: ReadonlyArray<string> = [
  'Upload a controlled knowledge document and start the Sources flow',
  'Show the currently activated accepted release in Graph mode',
  'Enter Tender Inspect mode to analyze a new tender document',
  'Compare the current V0 vs V1 candidate graph differences',
  'Run evaluation and surface the GO / STOP_REVISE / SPLIT_FIX decision',
] as const

export function deriveEmptyChatPrompts(
  context: KnowledgeWorkbenchContext,
  options?: { studioSurface?: boolean },
): string[] {
  const prompts: string[] = []
  if (context.activeSourceIdentityRef) {
    prompts.push('查看本来源的核心候选')
    prompts.push('比较与上一轮的证据差异')
  }
  if (context.selectedCandidateId) {
    prompts.push('帮助我审阅这个候选')
    prompts.push('为什么这个候选被这样 grounding？')
  }
  if (context.graphRef) {
    prompts.push('在此图谱中寻找敏感规则')
    prompts.push('显示与此节点相关的全部 EvidenceRef')
  }
  if (prompts.length === 0) {
    if (options?.studioSurface === true) {
      return [...STUDIO_WORKBENCH_EMPTY_PROMPTS]
    }
    return [...STUDIO_EMPTY_CHAT_PROMPTS]
  }
  return prompts
}
