import { useEffect, useRef } from 'react'
import { EdgeCurvedArrowProgram, indexParallelEdgesIndex } from '@sigma/edge-curve'
import { createNodeBorderProgram } from '@sigma/node-border'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import Sigma from 'sigma'

import type { GraphViewModel } from '@/contracts/graph-view-model'
import { projectGraphViewModel } from './graphology-projection'
import type { LayoutAlgorithm } from '@/stores/contextgraph-studio-store'
import { cssToken, graphCategoryColor, stableGraphKeyHash } from './graph-viz-palette'
import { uprightEdgeLabel } from './edge-labels'

function structuralColor(): string {
  return cssToken('--theme-muted', '#91918c')
}

function selectionColor(): string {
  return cssToken('--theme-text', '#163300')
}

function setCircular(graph: ReturnType<typeof projectGraphViewModel>) {
  const ids = graph.nodes()
  ids.forEach((nodeId, index) => {
    const angle = (index / Math.max(ids.length, 1)) * Math.PI * 2 - Math.PI / 2
    graph.mergeNodeAttributes(nodeId, { x: Math.cos(angle), y: Math.sin(angle) })
  })
}

function setRandom(graph: ReturnType<typeof projectGraphViewModel>) {
  graph.forEachNode((nodeId) => {
    const hx = stableGraphKeyHash(`${nodeId}:x`) / 0xffffffff
    const hy = stableGraphKeyHash(`${nodeId}:y`) / 0xffffffff
    graph.mergeNodeAttributes(nodeId, { x: hx * 2 - 1, y: hy * 2 - 1 })
  })
}

function setCirclepack(graph: ReturnType<typeof projectGraphViewModel>) {
  const groups = new Map<string, string[]>()
  graph.forEachNode((nodeId, attrs) => {
    const key = String(attrs.semanticType || 'unknown')
    const group = groups.get(key) ?? []
    group.push(nodeId)
    groups.set(key, group)
  })
  const entries = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  entries.forEach(([, nodeIds], groupIndex) => {
    const groupAngle = (groupIndex / Math.max(entries.length, 1)) * Math.PI * 2
    const centerX = Math.cos(groupAngle) * 0.75
    const centerY = Math.sin(groupAngle) * 0.75
    const radius = Math.min(0.32, 0.08 + nodeIds.length * 0.012)
    nodeIds.forEach((nodeId, nodeIndex) => {
      const angle = (nodeIndex / Math.max(nodeIds.length, 1)) * Math.PI * 2
      graph.mergeNodeAttributes(nodeId, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    })
  })
}

function setNoverlaps(graph: ReturnType<typeof projectGraphViewModel>) {
  const ids = graph.nodes()
  if (ids.length === 0) return
  if (ids.length > 600) {
    const columns = Math.ceil(Math.sqrt(ids.length))
    const rows = Math.ceil(ids.length / columns)
    ids.forEach((nodeId, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      graph.mergeNodeAttributes(nodeId, {
        x: columns <= 1 ? 0 : (column / (columns - 1)) * 2 - 1,
        y: rows <= 1 ? 0 : (row / (rows - 1)) * 2 - 1,
      })
    })
    return
  }
  setRandom(graph)
  const minimumDistance = Math.max(0.08, 0.42 / Math.sqrt(Math.max(ids.length, 1)))
  for (let iteration = 0; iteration < 80; iteration += 1) {
    let moved = false
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const leftId = ids[leftIndex]
        const rightId = ids[rightIndex]
        const left = graph.getNodeAttributes(leftId)
        const right = graph.getNodeAttributes(rightId)
        let dx = Number(right.x ?? 0) - Number(left.x ?? 0)
        let dy = Number(right.y ?? 0) - Number(left.y ?? 0)
        let distance = Math.hypot(dx, dy)
        if (distance >= minimumDistance) continue
        if (distance < 1e-6) {
          const angle = ((stableGraphKeyHash(`${leftId}:${rightId}`) % 360) * Math.PI) / 180
          dx = Math.cos(angle) * 1e-3
          dy = Math.sin(angle) * 1e-3
          distance = Math.hypot(dx, dy)
        }
        const push = (minimumDistance - distance) / 2
        const ux = dx / distance
        const uy = dy / distance
        graph.mergeNodeAttributes(leftId, {
          x: Number(left.x ?? 0) - ux * push,
          y: Number(left.y ?? 0) - uy * push,
        })
        graph.mergeNodeAttributes(rightId, {
          x: Number(right.x ?? 0) + ux * push,
          y: Number(right.y ?? 0) + uy * push,
        })
        moved = true
      }
    }
    if (!moved) break
  }
}

function runForceDirectedStep(graph: ReturnType<typeof projectGraphViewModel>) {
  const ids = graph.nodes()
  const next = new Map<string, { x: number; y: number }>()
  const positions = new Map(
    ids.map((id) => {
      const attrs = graph.getNodeAttributes(id)
      return [id, { x: Number(attrs.x ?? 0), y: Number(attrs.y ?? 0) }] as const
    }),
  )

  ids.forEach((id) => {
    const current = positions.get(id) ?? { x: 0, y: 0 }
    let fx = 0
    let fy = 0

    ids.forEach((otherId) => {
      if (otherId === id) return
      const other = positions.get(otherId) ?? { x: 0, y: 0 }
      const dx = current.x - other.x
      const dy = current.y - other.y
      const distanceSquared = Math.max(dx * dx + dy * dy, 0.01)
      const repulsion = 0.0025 / distanceSquared
      fx += dx * repulsion
      fy += dy * repulsion
    })

    graph.forEachNeighbor(id, (neighborId) => {
      const other = positions.get(neighborId) ?? { x: 0, y: 0 }
      const dx = other.x - current.x
      const dy = other.y - current.y
      fx += dx * 0.012
      fy += dy * 0.012
    })

    fx += -current.x * 0.002
    fy += -current.y * 0.002
    next.set(id, { x: current.x + fx, y: current.y + fy })
  })

  next.forEach((position, id) => graph.mergeNodeAttributes(id, position))
}

function applyStaticLayout(
  graph: ReturnType<typeof projectGraphViewModel>,
  layout: LayoutAlgorithm,
) {
  if (layout === 'circular') setCircular(graph)
  if (layout === 'circlepack') setCirclepack(graph)
  if (layout === 'random') setRandom(graph)
  if (layout === 'noverlaps') setNoverlaps(graph)
}

export function ContextGraphSigmaViewer({
  model,
  selectedNodeId,
  selectedEdgeId,
  highlightedNodeIds,
  highlightedEdgeIds,
  search,
  layout,
  layoutRunning,
  dragEnabled,
  largeGraphPerformance,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  onCameraIntent,
  onRendererError,
  controlCommand,
}: {
  model: GraphViewModel
  selectedNodeId: string | null
  selectedEdgeId: string | null
  highlightedNodeIds: string[]
  highlightedEdgeIds: string[]
  search: string
  layout: LayoutAlgorithm
  layoutRunning: boolean
  dragEnabled: boolean
  largeGraphPerformance: boolean
  onSelectNode: (nodeId: string | null) => void
  onSelectEdge: (edgeId: string | null) => void
  onClearSelection: () => void
  onCameraIntent: (intent: { x: number; y: number; ratio: number } | null) => void
  onRendererError: (reason: string | null) => void
  controlCommand: { id: number; type: 'zoom-in' | 'zoom-out' | 'fit' | 'fullscreen' | 'reset-layout' } | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Sigma | null>(null)
  const graphRef = useRef<ReturnType<typeof projectGraphViewModel> | null>(null)
  const selectedNodeRef = useRef(selectedNodeId)
  const selectedEdgeRef = useRef(selectedEdgeId)
  const highlightedNodeIdsRef = useRef(highlightedNodeIds)
  const highlightedEdgeIdsRef = useRef(highlightedEdgeIds)
  const searchRef = useRef(search)
  const performanceRef = useRef(largeGraphPerformance)
  const dragEnabledRef = useRef(dragEnabled)
  const draggedNodeRef = useRef<string | null>(null)

  selectedNodeRef.current = selectedNodeId
  selectedEdgeRef.current = selectedEdgeId
  highlightedNodeIdsRef.current = highlightedNodeIds
  highlightedEdgeIdsRef.current = highlightedEdgeIds
  searchRef.current = search
  performanceRef.current = largeGraphPerformance
  dragEnabledRef.current = dragEnabled

  useEffect(() => {
    if (!containerRef.current) return
    let renderer: Sigma | null = null
    try {
      const graph = projectGraphViewModel(model)
      setCircular(graph)
      graph.forEachNode((nodeId, attrs) => {
        const semanticType = String(attrs.semanticType || 'unknown')
        const color = graphCategoryColor(semanticType)
        graph.mergeNodeAttributes(nodeId, {
          type: 'bordered',
          color,
          size: 9,
          borderSize: 0.07,
          borderColor: color,
          label: String(attrs.label || nodeId),
        })
      })
      graph.forEachEdge((edgeId, attrs) => {
        graph.mergeEdgeAttributes(edgeId, {
          type: 'curved',
          size: Math.max(1, Number(attrs.weight || 1)),
          color: structuralColor(),
          label: uprightEdgeLabel(String(attrs.relationshipType || 'related_to')),
        })
      })
      indexParallelEdgesIndex(graph)

      renderer = new Sigma(graph, containerRef.current, {
        allowInvalidContainer: true,
        defaultNodeType: 'bordered',
        nodeProgramClasses: {
          bordered: createNodeBorderProgram({
            borders: [
              {
                size: { attribute: 'borderSize', defaultValue: 0.07 },
                color: { attribute: 'borderColor', defaultValue: '#163300' },
              },
              { size: { fill: true }, color: { attribute: 'color', defaultValue: '#64748b' } },
            ],
          }),
        },
        defaultEdgeType: 'curved',
        edgeProgramClasses: { curved: EdgeCurvedArrowProgram },
        renderLabels: true,
        renderEdgeLabels: true,
        hideEdgesOnMove: largeGraphPerformance,
        nodeReducer: (nodeId, data) => {
          const selected = selectedNodeRef.current === nodeId
          const highlighted = highlightedNodeIdsRef.current.includes(nodeId)
          const q = searchRef.current.trim().toLocaleLowerCase()
          const matches = !q || `${data.label ?? ''} ${nodeId}`.toLocaleLowerCase().includes(q)
          return {
            ...data,
            size: selected ? 13 : highlighted ? 11 : matches ? Number(data.size ?? 9) : 6,
            borderSize: selected ? 0.18 : highlighted ? 0.13 : 0.07,
            borderColor: selected || highlighted ? selectionColor() : String(data.borderColor || data.color),
            forceLabel: selected || highlighted || Boolean(q && matches),
          }
        },
        edgeReducer: (edgeId, data) => {
          const selected = selectedEdgeRef.current === edgeId
          const highlighted = highlightedEdgeIdsRef.current.includes(edgeId)
          return {
            ...data,
            size: selected || highlighted ? Math.max(3, Number(data.size ?? 1)) : Number(data.size ?? 1),
            color: selected || highlighted ? selectionColor() : String(data.color || structuralColor()),
            forceLabel: selected || highlighted,
            label: selected || highlighted || !performanceRef.current ? data.label : '',
          }
        },
      })

      renderer.on('clickNode', ({ node }) => {
        onSelectEdge(null)
        onSelectNode(node)
      })
      renderer.on('clickEdge', ({ edge }) => {
        onSelectNode(null)
        onSelectEdge(edge)
      })
      renderer.on('clickStage', () => onClearSelection())
      renderer.on('downNode', ({ node }) => {
        if (!dragEnabledRef.current) return
        draggedNodeRef.current = node
        renderer?.getCamera().disable()
        if (!renderer?.getCustomBBox()) renderer?.setCustomBBox(renderer.getBBox())
      })
      renderer.getMouseCaptor().on('mousemovebody', (event) => {
        const node = draggedNodeRef.current
        if (!node || !dragEnabledRef.current) return
        const position = renderer?.viewportToGraph(event)
        if (!position) return
        graph.mergeNodeAttributes(node, { x: position.x, y: position.y })
        renderer?.refresh({ skipIndexation: true })
      })
      renderer.getMouseCaptor().on('mouseup', () => {
        if (!draggedNodeRef.current) return
        draggedNodeRef.current = null
        renderer?.getCamera().enable()
      })
      renderer.getCamera().on('updated', (state) => {
        onCameraIntent({ x: state.x, y: state.y, ratio: state.ratio })
      })

      graphRef.current = graph
      rendererRef.current = renderer
      onRendererError(null)
    } catch (error) {
      onRendererError(error instanceof Error ? error.message : 'Sigma renderer initialization failed')
    }

    return () => {
      renderer?.kill()
      rendererRef.current = null
      graphRef.current = null
    }
  }, [model, onCameraIntent, onClearSelection, onRendererError, onSelectEdge, onSelectNode])

  useEffect(() => {
    rendererRef.current?.refresh({ skipIndexation: true })
  }, [selectedNodeId, selectedEdgeId, highlightedNodeIds, highlightedEdgeIds, search, largeGraphPerformance, dragEnabled])

  useEffect(() => {
    const graph = graphRef.current
    const renderer = rendererRef.current
    if (!graph || !renderer) return

    applyStaticLayout(graph, layout)
    if (layout !== 'force-atlas' && layout !== 'force-directed') {
      renderer.refresh()
      return
    }

    if (!layoutRunning) return
    let cancelled = false
    let frame = 0
    const tick = () => {
      if (cancelled || frame >= 120) return
      if (layout === 'force-atlas') {
        forceAtlas2.assign(graph, {
          iterations: largeGraphPerformance ? 1 : 2,
          settings: forceAtlas2.inferSettings(graph),
        })
      } else {
        const steps = largeGraphPerformance ? 1 : 2
        for (let index = 0; index < steps; index += 1) runForceDirectedStep(graph)
      }
      renderer.refresh({ skipIndexation: false })
      frame += 1
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => {
      cancelled = true
    }
  }, [layout, layoutRunning, largeGraphPerformance])

  useEffect(() => {
    if (!controlCommand) return
    const renderer = rendererRef.current
    if (!renderer) return
    const camera = renderer.getCamera()
    if (controlCommand.type === 'zoom-in') camera.animatedZoom({ duration: 180 })
    if (controlCommand.type === 'zoom-out') camera.animatedUnzoom({ duration: 180 })
    if (controlCommand.type === 'fit') camera.animatedReset({ duration: 220 })
    if (controlCommand.type === 'reset-layout') {
      const graph = graphRef.current
      if (graph) {
        setCircular(graph)
        renderer.refresh()
        camera.animatedReset({ duration: 220 })
      }
    }
    if (controlCommand.type === 'fullscreen') {
      void containerRef.current?.requestFullscreen?.().catch(() => undefined)
    }
  }, [controlCommand])

  return (
    <div
      ref={containerRef}
      data-testid="contextgraph-sigma-viewer"
      className="absolute inset-0 h-full w-full bg-background"
      role="application"
      aria-label="ContextGraph Sigma viewer"
    />
  )
}
