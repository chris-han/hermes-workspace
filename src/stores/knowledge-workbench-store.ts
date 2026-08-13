import { create } from 'zustand'

import {
  GraphInteractionCommandSchema,
  type GraphInteractionCommand,
} from '@/contracts/graph-interaction'
import type { GraphViewModel } from '@/contracts/graph-view-model'
import type { KnowledgeWorkbenchContext } from '@/contracts/knowledge-workbench'

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
  clearFocus: () => void
}

const EMPTY_CONTEXT: KnowledgeWorkbenchContext = {
  candidateGraphId: null,
  acceptedReleaseId: null,
  acceptedReleaseVersion: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedRuleIds: [],
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

export const useKnowledgeWorkbenchStore = create<WorkbenchState>((set, get) => ({
  context: EMPTY_CONTEXT,
  presentation: EMPTY_PRESENTATION,
  diagnostic: null,
  appliedCommandIds: new Set(),
  setContext: (context) => {
    const previous = get().context
    const identityChanged =
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
    if (value.nodeIds.some((id) => !nodeIds.has(id)) || value.edgeIds.some((id) => !edgeIds.has(id))) {
      set({ diagnostic: 'graph_interaction_rejected_missing_id' })
      return false
    }
    const nextIds = new Set(appliedCommandIds)
    nextIds.add(value.commandId)
    set({
      presentation: {
        highlightedNodeIds: value.action === 'clear_focus' ? [] : value.nodeIds,
        highlightedEdgeIds: value.action === 'clear_focus' ? [] : value.edgeIds,
        dimOthers: value.dimOthers,
        viewport: value.viewport,
      },
      diagnostic: 'graph_interaction_applied',
      appliedCommandIds: nextIds,
    })
    return true
  },
  clearFocus: () => set({ presentation: EMPTY_PRESENTATION }),
}))
