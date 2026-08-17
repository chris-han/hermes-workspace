import { create } from 'zustand'

import type { GraphViewModel } from '@/contracts/graph-view-model'

/**
 * ContextGraph Studio presentation state.
 *
 * State ownership contract (frozen):
 *
 * | Layer                          | Owner                                 |
 * | ------------------------------ | ------------------------------------- |
 * | Canonical runtime snapshot     | server + React Query cache             |
 * | Renderer projection            | derived Graphology/Sigma object       |
 * | Studio presentation state      | THIS store (contextgraph-studio-store)|
 * | Chat projection                | KnowledgeWorkbenchContext.v2          |
 *
 * Rules:
 * - GraphViewModel.v2 is immutable from the browser's point of view.
 * - Layout, camera, filters, inspector state, pane geometry, source/chat
 *   open state are presentation only.
 * - Studio selection IDs are presentation state, but they are valid only
 *   while they resolve against the current GraphViewModel identity.
 */

export type StudioMode =
  | 'sources'
  | 'extract'
  | 'ground'
  | 'graph'
  | 'inspect'
  | 'compare'
  | 'evaluate'

export type LayoutAlgorithm =
  | 'circular'
  | 'circlepack'
  | 'random'
  | 'noverlaps'
  | 'force-directed'
  | 'force-atlas'

export type StudioIdentity = {
  graphRef: string
  graphVersion: string
  graphHash: string
  authorityState: 'candidate' | 'authoritative'
  semanticaCommit: string | null
}

export type CameraIntent = {
  x: number
  y: number
  ratio: number
}

type StudioState = {
  // mode + pane state
  mode: StudioMode
  sourceOpen: boolean
  sourceWidth: number | null
  legendOpen: boolean
  settingsOpen: boolean
  inspectorOpen: boolean

  // selection (presentation only)
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedCandidateId: string | null
  selectedEvidenceRef: string | null

  // graph presentation
  graphSearch: string
  graphLayout: LayoutAlgorithm
  layoutRunning: boolean
  largeGraphPerformance: boolean
  cameraIntent: CameraIntent | null
  dragEnabled: boolean

  // mvl / workflow
  mvlWorkflowSummary: {
    v0RunRef: string | null
    v1RunRef: string | null
    learningDecision: 'GO' | 'STOP_REVISE' | 'SPLIT_FIX' | null
    evaluationRunId: string | null
  }

  // cache the last successfully parsed runtime identity (presentation)
  lastIdentity: StudioIdentity | null

  // actions — all write to presentation state only, never mutate
  // the GraphViewModel snapshot.
  setMode: (mode: StudioMode) => void
  setSourceOpen: (open: boolean) => void
  setSourceWidth: (width: number | null) => void
  setLegendOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setInspectorOpen: (open: boolean) => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  selectCandidate: (id: string | null) => void
  selectEvidenceRef: (ref: string | null) => void
  setGraphSearch: (search: string) => void
  setGraphLayout: (layout: LayoutAlgorithm) => void
  setLayoutRunning: (running: boolean) => void
  setDragEnabled: (enabled: boolean) => void
  setCameraIntent: (intent: CameraIntent | null) => void
  invalidateSelectionForIdentity: (identity: StudioIdentity) => void
  applyLargeGraphPerformance: (nodeCount: number, edgeCount: number) => void
  setMvlWorkflowSummary: (summary: StudioState['mvlWorkflowSummary']) => void
  setLastIdentity: (identity: StudioIdentity | null) => void
  reset: () => void
}

const THRESHOLD_NODE_COUNT = 1500
const THRESHOLD_EDGE_COUNT = 4000

const initialState = {
  mode: 'sources' as StudioMode,
  sourceOpen: false,
  sourceWidth: null as number | null,
  legendOpen: false,
  settingsOpen: false,
  inspectorOpen: true,
  selectedNodeId: null as string | null,
  selectedEdgeId: null as string | null,
  selectedCandidateId: null as string | null,
  selectedEvidenceRef: null as string | null,
  graphSearch: '',
  graphLayout: 'force-atlas' as LayoutAlgorithm,
  layoutRunning: false,
  largeGraphPerformance: false,
  cameraIntent: null as CameraIntent | null,
  dragEnabled: true,
  mvlWorkflowSummary: {
    v0RunRef: null,
    v1RunRef: null,
    learningDecision: null,
    evaluationRunId: null,
  },
  lastIdentity: null as StudioIdentity | null,
}

export const useContextGraphStudioStore = create<StudioState>()((set, get) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),

  setSourceOpen: (open) => set({ sourceOpen: open }),
  setSourceWidth: (width) => set({ sourceWidth: width }),
  setLegendOpen: (open) => set({ legendOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),

  selectNode: (id) => set({ selectedNodeId: id }),
  selectEdge: (id) => set({ selectedEdgeId: id }),
  selectCandidate: (id) => set({ selectedCandidateId: id }),
  selectEvidenceRef: (ref) => set({ selectedEvidenceRef: ref }),

  setGraphSearch: (search) => set({ graphSearch: search }),
  setGraphLayout: (layout) => set({ graphLayout: layout }),
  setLayoutRunning: (running) => set({ layoutRunning: running }),
  setDragEnabled: (enabled) => set({ dragEnabled: enabled }),
  setCameraIntent: (intent) => set({ cameraIntent: intent }),

  /**
   * Identity change handler. Compares the incoming canonical identity
   * (graphRef/version/hash/authorityState) against the previously known
   * identity and clears stale presentation selections if anything has
   * changed. This satisfies CF-E13 from the plan.
   *
   * The first identity load (when `lastIdentity` is null) only records the
   * identity without clearing selection so a freshly mounted Studio does
   * not lose any selection already made during the same route visit.
   */
  invalidateSelectionForIdentity: (identity) => {
    const prev = get().lastIdentity
    if (prev === null) {
      set({ lastIdentity: identity })
      return
    }
    const identityChanged =
      prev.graphRef !== identity.graphRef ||
      prev.graphVersion !== identity.graphVersion ||
      prev.graphHash !== identity.graphHash ||
      prev.authorityState !== identity.authorityState

    if (!identityChanged) return

    set({
      lastIdentity: identity,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedCandidateId: null,
      selectedEvidenceRef: null,
      cameraIntent: null,
    })
  },

  /**
   * Large-graph performance mode follows the frozen threshold from
   * the plan (CF-E17):
   *
   *   performance_mode = node_count >= 1500 OR edge_count >= 4000
   */
  applyLargeGraphPerformance: (nodeCount, edgeCount) => {
    const enabled =
      nodeCount >= THRESHOLD_NODE_COUNT || edgeCount >= THRESHOLD_EDGE_COUNT
    set({ largeGraphPerformance: enabled })
  },

  setMvlWorkflowSummary: (summary) => set({ mvlWorkflowSummary: summary }),
  setLastIdentity: (identity) => set({ lastIdentity: identity }),

  reset: () => set({ ...initialState }),
}))

/**
 * Helper hook for components that need to know whether a presentation
 * selection is still valid against the currently loaded GraphViewModel.
 * Returns the matching node/edge object when present, null otherwise.
 */
export function resolveValidSelection(
  viewModel: GraphViewModel | null,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
) {
  if (!viewModel) return { node: null, edge: null }
  const node =
    viewModel.nodes.find((candidate) => candidate.id === selectedNodeId) ??
    null
  const edge =
    viewModel.edges.find((candidate) => candidate.id === selectedEdgeId) ??
    null
  return { node, edge }
}
