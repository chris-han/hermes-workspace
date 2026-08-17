import { create } from 'zustand'

import {
  GraphInteractionCommandSchema,
  type GraphInteractionCommand,
} from '@/contracts/graph-interaction'
import type { GraphViewModel } from '@/contracts/graph-view-model'
import type { KnowledgeWorkbenchContext } from '@/contracts/knowledge-workbench'
import type { KnowledgeWorkbenchResult } from '@/contracts/knowledge-workbench'

export type InteractionDiagnostic =
  | 'graph_interaction_applied'
  | 'graph_interaction_rejected_stale'
  | 'graph_interaction_rejected_missing_id'
  | 'graph_interaction_rejected_duplicate'

export type WorkbenchPresentation = {
  highlightedNodeIds: string[]
  highlightedEdgeIds: string[]
  dimOthers: boolean
  viewport: 'unchanged' | 'fit_selection'
}

type WorkbenchState = {
  context: KnowledgeWorkbenchContext
  presentation: WorkbenchPresentation
  diagnostic: InteractionDiagnostic | null
  appliedCommandIds: Set<string>
  setContext: (context: KnowledgeWorkbenchContext) => void
  applyInteraction: (command: unknown, graph: GraphViewModel) => boolean
  applyWorkbenchResult: (
    result: KnowledgeWorkbenchResult,
    graph: GraphViewModel,
  ) => boolean
  clearFocus: () => void
}

const EMPTY_CONTEXT: KnowledgeWorkbenchContext = {
  schemaVersion: 'knowledge_workbench_context.v2',
  activeFunction: null,
  userIntent: null,
  graphRef: null,
  graphVersion: null,
  graphHash: null,
  authorityState: 'candidate',
  runMode: null,
  candidateGraphId: null,
  acceptedReleaseId: null,
  acceptedReleaseVersion: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedRuleIds: [],
  selectedCandidateId: null,
  selectedEvidenceRefs: [],
  activeSourceIdentityRef: null,
  sourceAnchors: [],
  governanceState: 'candidate',
  hasAcceptedRelease: false,
  extractionRunId: null,
  providerRef: null,
  providerCommit: null,
}

const EMPTY_PRESENTATION: WorkbenchPresentation = {
  highlightedNodeIds: [],
  highlightedEdgeIds: [],
  dimOthers: false,
  viewport: 'unchanged',
}

export const useKnowledgeWorkbenchStore = create<WorkbenchState>(
  (set, get) => ({
    context: EMPTY_CONTEXT,
    presentation: EMPTY_PRESENTATION,
    diagnostic: null,
    appliedCommandIds: new Set(),
    setContext: (context) => {
      const previous = get().context
      const identityChanged =
        previous.graphRef !== context.graphRef ||
        previous.graphVersion !== context.graphVersion ||
        previous.candidateGraphId !== context.candidateGraphId ||
        previous.acceptedReleaseId !== context.acceptedReleaseId
      set({
        context,
        ...(identityChanged
          ? { presentation: EMPTY_PRESENTATION, appliedCommandIds: new Set() }
          : {}),
      })
    },
    applyInteraction: (rawCommand, graph) => {
      const command = GraphInteractionCommandSchema.safeParse(rawCommand)
      if (!command.success) {
        set({ diagnostic: 'graph_interaction_rejected_stale' })
        return false
      }
      const value: GraphInteractionCommand = command.data
      const { context, appliedCommandIds } = get()
      if (
        value.candidateGraphId !== context.candidateGraphId ||
        value.acceptedReleaseId !== context.acceptedReleaseId ||
        value.candidateGraphId !== graph.candidateGraphId ||
        value.acceptedReleaseId !== graph.acceptedReleaseId
      ) {
        set({ diagnostic: 'graph_interaction_rejected_stale' })
        return false
      }
      if (appliedCommandIds.has(value.commandId)) {
        set({ diagnostic: 'graph_interaction_rejected_duplicate' })
        return false
      }
      const nodeIds = new Set(graph.nodes.map((node) => node.id))
      const edgeIds = new Set(graph.edges.map((edge) => edge.id))
      if (
        value.nodeIds.some((id) => !nodeIds.has(id)) ||
        value.edgeIds.some((id) => !edgeIds.has(id))
      ) {
        set({ diagnostic: 'graph_interaction_rejected_missing_id' })
        return false
      }
      const nextIds = new Set(appliedCommandIds)
      nextIds.add(value.commandId)
      set({
        context: {
          ...context,
          selectedNodeIds: value.nodeIds,
          selectedEdgeIds: value.edgeIds,
        },
        presentation: {
          highlightedNodeIds:
            value.action === 'clear_focus' ? [] : value.nodeIds,
          highlightedEdgeIds:
            value.action === 'clear_focus' ? [] : value.edgeIds,
          dimOthers: value.dimOthers,
          viewport: value.viewport,
        },
        diagnostic: 'graph_interaction_applied',
        appliedCommandIds: nextIds,
      })
      return true
    },
    applyWorkbenchResult: (result, graph) => {
      if (
        result.candidateGraphId !== get().context.candidateGraphId ||
        result.acceptedReleaseId !== get().context.acceptedReleaseId
      ) {
        set({ diagnostic: 'graph_interaction_rejected_stale' })
        return false
      }
      if (
        result.interaction &&
        !get().applyInteraction(result.interaction, graph)
      )
        return false
      set((state) => ({
        context: {
          ...state.context,
          selectedNodeIds: result.focus.nodeIds,
          selectedEdgeIds: result.focus.edgeIds,
          selectedRuleIds: result.focus.ruleIds,
          selectedEvidenceRefs: result.focus.evidenceRefs,
          sourceAnchors: result.focus.sourceAnchors,
        },
      }))
      return true
    },
    clearFocus: () => set({ presentation: EMPTY_PRESENTATION }),
  }),
)
