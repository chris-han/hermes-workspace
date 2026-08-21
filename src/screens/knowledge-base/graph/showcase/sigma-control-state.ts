import type { ShowcaseGraphModel } from './semantica-showcase-types'
import type { SigmaGraphReadonlySelection } from '../sigma-graph-readonly'
import type { GraphTopologyMode } from '../layouts/graph-topology-layouts'

export type SigmaDirection = 'LR' | 'RL' | 'TB' | 'BT'
export type SigmaFocusMode = 'entire' | 'neighbors' | 'two-hop' | 'incoming' | 'outgoing'
export type SigmaNodeSizeMode = 'degree' | 'uniform'
export type SigmaNodeColorMode = 'semantic' | 'asimov' | 'uniform'
export type SigmaEdgeColorMode = 'semantic' | 'uniform'
export type SigmaNodeLabelMode = 'all' | 'selected' | 'none'
export type SigmaEdgeLabelMode = 'all' | 'selected' | 'neighborhood' | 'none'

export const ASIMOV_VISUALIZATION_SWATCHES = [
  '#ff4d00',
  '#ff8040',
  '#ff1a5e',
  '#9fe870',
  '#5fd43a',
  '#d9b32d',
  '#ffe566',
  '#8fb8ff',
  '#4a7fe8',
  '#ffc5d7',
  '#1c1a2e',
  '#f7f3ed',
] as const

function stableNodeSwatch(nodeId: string): string {
  let hash = 2166136261
  for (let index = 0; index < nodeId.length; index += 1) {
    hash ^= nodeId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ASIMOV_VISUALIZATION_SWATCHES[(hash >>> 0) % ASIMOV_VISUALIZATION_SWATCHES.length]
}

export interface SigmaControlState {
  direction: SigmaDirection
  focus: SigmaFocusMode
  spacing: number
  gravity: number
  nodeSize: SigmaNodeSizeMode
  nodeColor: SigmaNodeColorMode
  edgeColor: SigmaEdgeColorMode
  nodeLabels: SigmaNodeLabelMode
  edgeLabels: SigmaEdgeLabelMode
  edgeArrows: boolean
  scale: number
}

export const DEFAULT_SIGMA_CONTROLS: SigmaControlState = {
  direction: 'LR',
  focus: 'entire',
  spacing: 58,
  gravity: 36,
  nodeSize: 'degree',
  nodeColor: 'semantic',
  edgeColor: 'semantic',
  nodeLabels: 'all',
  edgeLabels: 'all',
  edgeArrows: true,
  scale: 50,
}

export function applySigmaPositionControls(
  positions: Record<string, { x: number; y: number }>,
  topology: GraphTopologyMode,
  controls: SigmaControlState,
): Record<string, { x: number; y: number }> {
  const entries = Object.entries(positions)
  if (entries.length === 0) return positions

  const centerX = entries.reduce((sum, [, point]) => sum + point.x, 0) / entries.length
  const centerY = entries.reduce((sum, [, point]) => sum + point.y, 0) / entries.length
  const spacingScale = 0.55 + (controls.spacing / 100) * 1.15
  const gravityScale = 1.35 - (controls.gravity / 100) * 0.7
  const advancedScale = 0.75 + (controls.scale / 100) * 0.5
  const scale = spacingScale * gravityScale * advancedScale

  return Object.fromEntries(
    entries.map(([id, point]) => {
      let x = (point.x - centerX) * scale
      let y = (point.y - centerY) * scale

      if (topology === 'hierarchical') {
        if (controls.direction === 'LR') [x, y] = [y, x]
        if (controls.direction === 'RL') [x, y] = [-y, x]
        if (controls.direction === 'BT') y = -y
      }

      return [id, { x, y }]
    }),
  )
}

function buildAdjacency(model: ShowcaseGraphModel) {
  const undirected = new Map<string, Set<string>>()
  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()
  for (const node of model.nodes) {
    undirected.set(node.id, new Set())
    outgoing.set(node.id, new Set())
    incoming.set(node.id, new Set())
  }
  for (const edge of model.edges) {
    undirected.get(edge.source)?.add(edge.target)
    undirected.get(edge.target)?.add(edge.source)
    outgoing.get(edge.source)?.add(edge.target)
    incoming.get(edge.target)?.add(edge.source)
  }
  return { undirected, outgoing, incoming }
}

function focusedNodeIds(
  model: ShowcaseGraphModel,
  selection: SigmaGraphReadonlySelection | undefined,
  mode: SigmaFocusMode,
): Set<string> | null {
  if (mode === 'entire' || selection?.type !== 'node') return null
  const selectedId = selection.id
  const { undirected, outgoing, incoming } = buildAdjacency(model)
  const keep = new Set<string>([selectedId])

  if (mode === 'neighbors') {
    undirected.get(selectedId)?.forEach((id) => keep.add(id))
  } else if (mode === 'incoming') {
    incoming.get(selectedId)?.forEach((id) => keep.add(id))
  } else if (mode === 'outgoing') {
    outgoing.get(selectedId)?.forEach((id) => keep.add(id))
  } else if (mode === 'two-hop') {
    const first = [...(undirected.get(selectedId) ?? [])]
    first.forEach((id) => keep.add(id))
    first.forEach((id) => undirected.get(id)?.forEach((neighbor) => keep.add(neighbor)))
  }

  return keep
}

export function applySigmaModelControls(
  model: ShowcaseGraphModel,
  selection: SigmaGraphReadonlySelection | undefined,
  controls: SigmaControlState,
): ShowcaseGraphModel {
  const keep = focusedNodeIds(model, selection, controls.focus)
  const visibleNodes = keep ? model.nodes.filter((node) => keep.has(node.id)) : model.nodes
  const visibleIds = new Set(visibleNodes.map((node) => node.id))
  const visibleEdges = model.edges.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
  )

  const degree = new Map<string, number>()
  visibleNodes.forEach((node) => degree.set(node.id, 0))
  visibleEdges.forEach((edge) => {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  })

  const selectedId = selection?.type === 'node' ? selection.id : null
  const selectedNeighbors = new Set<string>()
  if (selectedId) {
    selectedNeighbors.add(selectedId)
    visibleEdges.forEach((edge) => {
      if (edge.source === selectedId) selectedNeighbors.add(edge.target)
      if (edge.target === selectedId) selectedNeighbors.add(edge.source)
    })
  }

  const nodes = visibleNodes.map((node) => {
    const showLabel = controls.nodeLabels === 'all'
      || (controls.nodeLabels === 'selected' && selectedNeighbors.has(node.id))
    const color = controls.nodeColor === 'semantic'
      ? node.color
      : controls.nodeColor === 'asimov'
        ? stableNodeSwatch(node.id)
        : '#72787e'

    return {
      ...node,
      label: showLabel ? node.label : '',
      size: controls.nodeSize === 'uniform'
        ? 10
        : Math.min(20, 8 + Math.sqrt(degree.get(node.id) ?? 0) * 3),
      color,
    }
  })

  const edges = visibleEdges.map((edge) => {
    const incidentToSelection = Boolean(
      selectedId && (edge.source === selectedId || edge.target === selectedId),
    )
    const neighborhoodEdge = Boolean(
      selectedId && selectedNeighbors.has(edge.source) && selectedNeighbors.has(edge.target),
    )
    const showLabel = controls.edgeLabels === 'all'
      || (controls.edgeLabels === 'selected' && incidentToSelection)
      || (controls.edgeLabels === 'neighborhood' && neighborhoodEdge)
    return {
      ...edge,
      label: showLabel ? edge.label : '',
      color: controls.edgeColor === 'uniform' ? '#c2c7ce' : edge.color,
    }
  })

  return { nodes, edges }
}
