import '@/asimov-visualization-swatches.css'

import type { ShowcaseGraphModel } from './semantica-showcase-types'
import type { SigmaGraphReadonlySelection } from '../sigma-graph-readonly'
import type { GraphTopologyMode } from '../layouts/graph-topology-layouts'

export type SigmaDirection = 'LR' | 'RL' | 'TB' | 'BT'
export type SigmaFocusMode = 'entire' | 'neighbors' | 'two-hop' | 'incoming' | 'outgoing'
export type SigmaNodeSizeMode = 'degree' | 'uniform'
export type SigmaDragMode = 'node' | 'branch'
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
export type SigmaEdgeColorMode = 'semantic' | 'asimov' | 'uniform' | AsimovVisualizationSwatch
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

function stableAsimovSwatch(seed: string): AsimovVisualizationSwatch {
  const swatches = Object.keys(ASIMOV_VISUALIZATION_SWATCH_TOKENS) as AsimovVisualizationSwatch[]
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return swatches[(hash >>> 0) % swatches.length]
}

function formatPropertyValue(value: unknown): string {
  let text: string
  if (typeof value === 'string') {
    text = value
  } else {
    try {
      text = JSON.stringify(value)
    } catch {
      text = String(value)
    }
  }
  return text.length > 40 ? `${text.slice(0, 37)}…` : text
}

function formatProperties(properties?: Record<string, unknown>): string {
  if (!properties) return ''
  return Object.entries(properties)
    .map(([key, value]) => `${key}=${formatPropertyValue(value)}`)
    .join(' · ')
}

export interface SigmaControlState {
  direction: SigmaDirection
  focus: SigmaFocusMode
  dragMode: SigmaDragMode
  pinDrop: boolean
  rotate: boolean
  overlap: boolean
  spacing: number
  gravity: number
  nodeSize: SigmaNodeSizeMode
  nodeColor: SigmaNodeColorMode
  edgeColor: SigmaEdgeColorMode
  edgeWidth: number
  nodeLabels: SigmaNodeLabelMode
  edgeLabels: SigmaEdgeLabelMode
  showProperties: boolean
  confidence: number
  barnesHut: boolean
  edgeCurved: boolean
  edgeArrows: boolean
  scale: number
}

export const DEFAULT_SIGMA_CONTROLS: SigmaControlState = {
  direction: 'LR',
  focus: 'entire',
  dragMode: 'node',
  pinDrop: false,
  rotate: false,
  overlap: true,
  spacing: 58,
  gravity: 36,
  nodeSize: 'degree',
  nodeColor: 'semantic',
  edgeColor: 'semantic',
  edgeWidth: 50,
  nodeLabels: 'all',
  edgeLabels: 'all',
  showProperties: false,
  confidence: 0,
  barnesHut: false,
  edgeCurved: false,
  edgeArrows: true,
  scale: 50,
}

function normalizeConfidenceValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value > 1 && value <= 100) return value / 100
  if (value > 100) return 1
  if (value < 0) return 0
  return value
}

function stableUnitValue(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 1000) / 1000
}

function edgeConfidence(edge: { id: string; properties?: Record<string, unknown> }): number {
  const candidates = ['confidence', 'score', 'weight', 'probability'] as const
  for (const key of candidates) {
    const raw = edge.properties?.[key]
    if (typeof raw === 'number') return normalizeConfidenceValue(raw)
  }
  return stableUnitValue(edge.id)
}

export function applySigmaPositionControls(
  positions: Record<string, { x: number; y: number }>,
  topology: GraphTopologyMode,
  controls: SigmaControlState,
  selection?: SigmaGraphReadonlySelection,
): Record<string, { x: number; y: number }> {
  const entries = Object.entries(positions)
  if (entries.length === 0) return positions

  const centerX = entries.reduce((sum, [, point]) => sum + point.x, 0) / entries.length
  const centerY = entries.reduce((sum, [, point]) => sum + point.y, 0) / entries.length
  const spacingScale = 0.35 + (controls.spacing / 100) * 2.1
  const gravityScale = 1.2 - (controls.gravity / 100) * 0.95
  const advancedScale = 0.75 + (controls.scale / 100) * 0.5
  const scale = spacingScale * gravityScale * advancedScale

  const transformed = entries.map(([id, point]) => {
    let x = (point.x - centerX) * scale
    let y = (point.y - centerY) * scale

    if (topology === 'hierarchical') {
      if (controls.direction === 'LR') [x, y] = [y, x]
      if (controls.direction === 'RL') [x, y] = [-y, x]
      if (controls.direction === 'BT') y = -y
    }

    if (controls.rotate) {
      [x, y] = [y, -x]
    }

    return [id, { x, y }] as const
  })

  const byId = Object.fromEntries(transformed)

  if (controls.pinDrop && selection?.type === 'node' && byId[selection.id]) {
    const anchor = byId[selection.id]
    for (const [, point] of transformed) {
      point.x -= anchor.x
      point.y -= anchor.y
    }
  }

  if (controls.overlap && transformed.length > 1) {
    // Deterministic, lightweight collision pass to keep dense layouts legible.
    const minDistance = 0.14 + (controls.spacing / 100) * 0.18
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < transformed.length; i += 1) {
        for (let j = i + 1; j < transformed.length; j += 1) {
          const a = transformed[i][1]
          const b = transformed[j][1]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const distance = Math.hypot(dx, dy)
          if (distance >= minDistance) continue
          const safeDistance = distance || 1e-4
          const push = (minDistance - safeDistance) / 2
          const ux = dx / safeDistance
          const uy = dy / safeDistance
          a.x -= ux * push
          a.y -= uy * push
          b.x += ux * push
          b.y += uy * push
        }
      }
    }
  }

  if (controls.barnesHut && transformed.length > 2) {
    // Deterministic force-relaxation pass approximating global repulsion.
    const points = transformed.map(([, point]) => point)
    const influence = 0.004 + (controls.spacing / 100) * 0.01
    for (let i = 0; i < points.length; i += 1) {
      const current = points[i]
      let forceX = 0
      let forceY = 0
      for (let j = 0; j < points.length; j += 1) {
        if (i === j) continue
        const other = points[j]
        const dx = current.x - other.x
        const dy = current.y - other.y
        const distanceSq = dx * dx + dy * dy + 0.01
        forceX += dx / distanceSq
        forceY += dy / distanceSq
      }
      current.x += forceX * influence
      current.y += forceY * influence
    }
  }

  return Object.fromEntries(transformed)
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
  const confidenceThreshold = controls.confidence / 100
  const visibleEdges = model.edges.filter(
    (edge) =>
      visibleIds.has(edge.source)
      && visibleIds.has(edge.target)
      && edgeConfidence(edge) >= confidenceThreshold,
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
    const propertiesLabel = controls.showProperties ? formatProperties(node.properties) : ''
    const label = [showLabel ? node.label : '', propertiesLabel].filter(Boolean).join(' · ')
    const color = controls.nodeColor === 'semantic'
      ? node.color
      : controls.nodeColor === 'asimov'
        ? resolveAsimovSwatch(stableAsimovSwatch(node.id))
        : controls.nodeColor === 'uniform'
          ? '#72787e'
          : resolveAsimovSwatch(controls.nodeColor)

    return {
      ...node,
      label,
      size: controls.nodeSize === 'uniform'
        ? 10
        : Math.min(20, 8 + Math.sqrt(degree.get(node.id) ?? 0) * 3),
      color,
    }
  })

  const nodeRadiusById = new Map(nodes.map((node) => [node.id, node.size ?? 10]))
  const edgeWidthRatio = 0.02 + (controls.edgeWidth / 100) * 0.18

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
    const propertiesLabel = controls.showProperties ? formatProperties(edge.properties) : ''
    const label = [showLabel ? edge.label : '', propertiesLabel].filter(Boolean).join(' · ')
    const color = controls.edgeColor === 'semantic'
      ? edge.color
      : controls.edgeColor === 'asimov'
        ? resolveAsimovSwatch(stableAsimovSwatch(edge.id))
        : controls.edgeColor === 'uniform'
          ? '#c2c7ce'
          : resolveAsimovSwatch(controls.edgeColor)
    const sourceDiameter = (nodeRadiusById.get(edge.source) ?? 10) * 2
    const targetDiameter = (nodeRadiusById.get(edge.target) ?? 10) * 2
    const averageNodeDiameter = (sourceDiameter + targetDiameter) / 2

    return {
      ...edge,
      label,
      size: Math.max(0.2, averageNodeDiameter * edgeWidthRatio),
      color,
    }
  })

  return { nodes, edges }
}
