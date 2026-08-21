import '@/asimov-visualization-swatches.css'

import type { ShowcaseGraphModel } from './semantica-showcase-types'
import type { SigmaGraphReadonlySelection } from '../sigma-graph-readonly'
import type { GraphTopologyMode } from '../layouts/graph-topology-layouts'

export type SigmaDirection = 'LR' | 'RL' | 'TB' | 'BT'
export type SigmaFocusMode = 'entire' | 'neighbors' | 'two-hop' | 'incoming' | 'outgoing'
export type SigmaNodeSizeMode = 'degree' | 'uniform'
export type AsimovVisualizationSwatch =
  | 'asimov-ember'
  | 'asimov-tangerine'
  | 'asimov-crimson'
  | 'asimov-lime'
  | 'asimov-fern'
  | 'asimov-gold'
  | 'asimov-butter'
  | 'asimov-periwinkle'
  | 'asimov-cobalt'
  | 'asimov-blush'
  | 'asimov-midnight'
  | 'asimov-ivory'
export type SigmaNodeColorMode = 'semantic' | 'asimov' | 'uniform' | AsimovVisualizationSwatch
export type SigmaEdgeColorMode = 'semantic' | 'uniform'
export type SigmaNodeLabelMode = 'all' | 'selected' | 'none'
export type SigmaEdgeLabelMode = 'all' | 'selected' | 'neighborhood' | 'none'

export const ASIMOV_VISUALIZATION_SWATCH_TOKENS: Record<AsimovVisualizationSwatch, string> = {
  'asimov-ember': '--asimov-visualization-swatch-ember',
  'asimov-tangerine': '--asimov-visualization-swatch-tangerine',
  'asimov-crimson': '--asimov-visualization-swatch-crimson',
  'asimov-lime': '--asimov-visualization-swatch-lime',
  'asimov-fern': '--asimov-visualization-swatch-fern',
  'asimov-gold': '--asimov-visualization-swatch-gold',
  'asimov-butter': '--asimov-visualization-swatch-butter',
  'asimov-periwinkle': '--asimov-visualization-swatch-periwinkle',
  'asimov-cobalt': '--asimov-visualization-swatch-cobalt',
  'asimov-blush': '--asimov-visualization-swatch-blush',
  'asimov-midnight': '--asimov-visualization-swatch-midnight',
  'asimov-ivory': '--asimov-visualization-swatch-ivory',
}

export const ASIMOV_VISUALIZATION_SWATCH_VARS = Object.values(ASIMOV_VISUALIZATION_SWATCH_TOKENS)
  .map((token) => `var(${token})`)

function resolveAsimovSwatch(swatch: AsimovVisualizationSwatch): string {
  if (typeof document === 'undefined') return '#72787e'
  const scope = document.querySelector<HTMLElement>('.asimov-minimalism')
  if (!scope) return '#72787e'
  return getComputedStyle(scope).getPropertyValue(ASIMOV_VISUALIZATION_SWATCH_TOKENS[swatch]).trim() || '#72787e'
}

function stableNodeSwatch(nodeId: string): AsimovVisualizationSwatch {
  const swatches = Object.keys(ASIMOV_VISUALIZATION_SWATCH_TOKENS) as AsimovVisualizationSwatch[]
  let hash = 2166136261
  for (let index = 0; index < nodeId.length; index += 1) {
    hash ^= nodeId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return swatches[(hash >>> 0) % swatches.length]
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
        ? resolveAsimovSwatch(stableNodeSwatch(node.id))
        : controls.nodeColor === 'uniform'
          ? '#72787e'
          : resolveAsimovSwatch(controls.nodeColor)

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
