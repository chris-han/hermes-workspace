/**
 * Readonly Sigma/Graphology renderer core.
 *
 * Both the live Graph Context (governed projection) and the Semantica
 * showcase adapters feed this core through their own readonly input DTO. The
 * core itself has no coupling to GovernedGraphProjection, runtime stores, or
 * the showcase subtree — it only takes a `SigmaGraphReadonlyInput`.
 */
import { useEffect, useRef } from 'react'
import Graph from 'graphology'
import { EdgeCurvedArrowProgram, indexParallelEdgesIndex } from '@sigma/edge-curve'
import Sigma from 'sigma'
import { createEdgeArrowProgram } from 'sigma/rendering'

import type { ShowcaseKgRendererInput, ShowcaseSemanticNetworkRendererInput } from './showcase/semantica-showcase-types'

export type SigmaGraphReadonlyNode = {
  id: string
  label: string
  group?: string
  size?: number
  color?: string
  properties?: Record<string, unknown>
  /** Optional pre-computed coordinates. Falls back to a circular layout. */
  x?: number
  y?: number
}

export type SigmaGraphReadonlyEdge = {
  id: string
  source: string
  target: string
  label?: string
  size?: number
  color?: string
  properties?: Record<string, unknown>
}

export type SigmaGraphReadonlySelection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | null

export type SigmaGraphReadonlyDragMode = 'node' | 'branch'

export interface SigmaGraphReadonlyInput {
  nodes: SigmaGraphReadonlyNode[]
  edges: SigmaGraphReadonlyEdge[]
  dragMode?: SigmaGraphReadonlyDragMode
  renderEdgeLabels?: boolean
  edgeArrows?: boolean
  edgeCurved?: boolean
  selection?: SigmaGraphReadonlySelection
  highlightedNodeIds?: string[]
  highlightedEdgeIds?: string[]
  positions?: Record<string, { x: number; y: number }>
  /** Display label used by tests and accessibility text. */
  ariaLabel?: string
}

export type SigmaGraphReadonlyViewportController = {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  getZoomRatio: () => number
}

function buildReadonlyGraph(input: SigmaGraphReadonlyInput): Graph {
  const graph = new Graph({ multi: true, type: 'directed' })
  const total = input.nodes.length || 1
  input.nodes.forEach((node, index) => {
    const angle = (index / total) * Math.PI * 2
    const resolvedPosition = input.positions?.[node.id] ?? {
      x: node['x'] ?? Math.cos(angle),
      y: node['y'] ?? Math.sin(angle),
    }
    graph.addNode(node.id, {
      label: node.label,
      x: resolvedPosition.x,
      y: resolvedPosition.y,
      size:
        node.size ??
        (input.selection?.type === 'node' && input.selection.id === node.id ? 14 : 10),
      color: node.color ?? '#64748b',
      group: node.group ?? 'default',
    })
  })
  input.edges.forEach((edge) => {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      return
    }
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      type: input.edgeCurved ? 'curved' : 'arrow',
      label: edge.label ?? '',
      size: edge.size ?? 1,
      color: edge.color ?? '#cbd5e1',
    })
  })
  if (input.edgeCurved) {
    indexParallelEdgesIndex(graph)
  }
  return graph
}

function buildRendererSettings(
  resolveLabelColor: () => string,
  input: SigmaGraphReadonlyInput,
) {
  const showEdgeLabels = input.renderEdgeLabels ?? true
  return {
    // Core visibility
    renderLabels: true,
    renderEdgeLabels: showEdgeLabels,
    edgeProgramClasses: input.edgeCurved
      ? {
          curved: EdgeCurvedArrowProgram,
        }
      : {
          arrow: createEdgeArrowProgram({
            lengthToThicknessRatio: 4.0,
            widenessToThicknessRatio: 2.8,
          }),
        },

    // Label styling (node + edge)
    labelColor: { color: resolveLabelColor() },
    edgeLabelColor: { color: resolveLabelColor() },
    labelSize: 12,
    edgeLabelSize: 11,
    labelWeight: '500',
    edgeLabelWeight: '500',

    // Readability thresholds tuned for dense showcase graphs
    labelRenderedSizeThreshold: 8,
    edgeLabelRenderedSizeThreshold: 1,

    // Edge direction presentation
    defaultEdgeType: input.edgeCurved ? 'curved' : input.edgeArrows === false ? 'line' : 'arrow',

    // Stable rendering behavior
    zIndex: true,
    allowInvalidContainer: true,
  }
}

export function SigmaGraphReadonly({
  input,
  onSelect,
  onViewportReady,
  onCameraChange,
  className,
  ariaLabel,
}: {
  input: SigmaGraphReadonlyInput
  onSelect?: (selection: SigmaGraphReadonlySelection) => void
  onViewportReady?: (controller: SigmaGraphReadonlyViewportController | null) => void
  onCameraChange?: (ratio: number) => void
  className?: string
  ariaLabel?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const graph = buildReadonlyGraph(input)
    const resolveLabelColor = () => {
      const themedColor = getComputedStyle(containerRef.current!).getPropertyValue('--asimov-text').trim()
      return themedColor || getComputedStyle(containerRef.current!).color || '#1a1b1e'
    }
    const renderer = new Sigma(graph, containerRef.current, buildRendererSettings(resolveLabelColor, input))
    const syncThemeColors = () => {
      const color = resolveLabelColor()
      renderer.setSetting('labelColor', { color })
      renderer.setSetting('edgeLabelColor', { color })
      renderer.refresh()
    }
    const themeObserver = new MutationObserver(syncThemeColors)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })
    let suppressClickUntil = 0
    if (onSelect) {
      renderer.on('clickNode', ({ node }) => {
        if (Date.now() < suppressClickUntil) return
        onSelect({ type: 'node', id: node })
      })
      renderer.on('clickEdge', ({ edge }) => {
        if (Date.now() < suppressClickUntil) return
        onSelect({ type: 'edge', id: edge })
      })
    }

    let cleanupDragHandlers = () => undefined
    const dragMode = input.dragMode
    const hasDragApis = typeof (renderer as { getMouseCaptor?: unknown }).getMouseCaptor === 'function'
      && typeof (renderer as { viewportToGraph?: unknown }).viewportToGraph === 'function'
    if (dragMode && hasDragApis) {
      let draggingNode: string | null = null
      let draggingGroup: string[] = []
      let startGraphPoint: { x: number; y: number } | null = null
      let dragDistance = 0
      let isDragging = false
      const previousEnableCamera = typeof (renderer as { getSetting?: unknown }).getSetting === 'function'
        ? renderer.getSetting('enableCamera')
        : true
      const startPositions = new Map<string, { x: number; y: number }>()

      const captor = renderer.getMouseCaptor()
      const viewportToGraph = (event: { x: number; y: number }) =>
        renderer.viewportToGraph(event)

      const branchAdjacency = new Map<string, Set<string>>()
      for (const node of input.nodes) {
        branchAdjacency.set(node.id, new Set())
      }
      for (const edge of input.edges) {
        if (!branchAdjacency.has(edge.source)) branchAdjacency.set(edge.source, new Set())
        if (!branchAdjacency.has(edge.target)) branchAdjacency.set(edge.target, new Set())
        branchAdjacency.get(edge.source)!.add(edge.target)
        branchAdjacency.get(edge.target)!.add(edge.source)
      }

      const collectBranchNodes = (nodeId: string): string[] => {
        const result = new Set<string>([nodeId, ...(branchAdjacency.get(nodeId) ?? [])])
        if (result.size === 1 && typeof (graph as { neighbors?: unknown }).neighbors === 'function') {
          for (const id of graph.neighbors(nodeId)) {
            result.add(id)
          }
        }
        return Array.from(result)
      }

      const handleDownNode = ({ node, event }: { node: string; event: { x: number; y: number } }) => {
        draggingNode = node
        startGraphPoint = viewportToGraph(event)
        dragDistance = 0

        if (dragMode === 'branch') {
          draggingGroup = collectBranchNodes(node)
        } else {
          draggingGroup = [node]
        }

        isDragging = true
        containerRef.current!.style.cursor = 'grabbing'
        if (typeof (renderer as { setSetting?: unknown }).setSetting === 'function') {
          renderer.setSetting('enableCamera', false)
        }

        startPositions.clear()
        for (const id of draggingGroup) {
          startPositions.set(id, {
            x: graph.getNodeAttribute(id, 'x'),
            y: graph.getNodeAttribute(id, 'y'),
          })
        }
      }

      const handleMove = (event: { x: number; y: number; preventSigmaDefault?: () => void; original?: { preventDefault?: () => void; stopPropagation?: () => void } }) => {
        if (!draggingNode || !startGraphPoint) return

        const graphPoint = viewportToGraph(event)
        const deltaX = graphPoint.x - startGraphPoint.x
        const deltaY = graphPoint.y - startGraphPoint.y
        dragDistance = Math.max(dragDistance, Math.hypot(deltaX, deltaY))

        for (const id of draggingGroup) {
          const origin = startPositions.get(id)
          if (!origin) continue
          graph.setNodeAttribute(id, 'x', origin.x + deltaX)
          graph.setNodeAttribute(id, 'y', origin.y + deltaY)
        }

        renderer.refresh()
        event.preventSigmaDefault?.()
        event.original?.preventDefault?.()
        event.original?.stopPropagation?.()
      }

      const handleUp = () => {
        draggingNode = null
        draggingGroup = []
        startGraphPoint = null
        isDragging = false
        containerRef.current!.style.cursor = ''
        if (dragDistance > 0.01) {
          // Ignore synthetic click after drag release to avoid selection-triggered relayout snap-back.
          suppressClickUntil = Date.now() + 220
        }
        if (typeof (renderer as { setSetting?: unknown }).setSetting === 'function') {
          renderer.setSetting('enableCamera', previousEnableCamera)
        }
        startPositions.clear()
      }

      const handleEnterNode = () => {
        if (!isDragging) {
          containerRef.current!.style.cursor = 'grab'
        }
      }

      const handleLeaveNode = () => {
        if (!isDragging) {
          containerRef.current!.style.cursor = ''
        }
      }

      renderer.on('downNode', handleDownNode)
      renderer.on('enterNode', handleEnterNode)
      renderer.on('leaveNode', handleLeaveNode)
      captor.on('mousemovebody', handleMove)
      captor.on('mouseup', handleUp)
      captor.on('mouseupoutside', handleUp)

      cleanupDragHandlers = () => {
        renderer.off('downNode', handleDownNode)
        renderer.off('enterNode', handleEnterNode)
        renderer.off('leaveNode', handleLeaveNode)
        captor.off('mousemovebody', handleMove)
        captor.off('mouseup', handleUp)
        captor.off('mouseupoutside', handleUp)
      }
    }
    const publishCameraRatio = () => onCameraChange?.(renderer.getCamera().getState().ratio)
    const hasCamera = typeof (renderer as { getCamera?: unknown }).getCamera === 'function'
    if (hasCamera) {
      renderer.getCamera().on('updated', publishCameraRatio)
      onViewportReady?.({
        zoomIn: () => renderer.getCamera().animatedZoom({ duration: 180 }),
        zoomOut: () => renderer.getCamera().animatedUnzoom({ duration: 180 }),
        fit: () => renderer.getCamera().animatedReset({ duration: 220 }),
        getZoomRatio: () => renderer.getCamera().getState().ratio,
      })
      publishCameraRatio()
    } else {
      onViewportReady?.(null)
    }
    sigmaRef.current = renderer
    return () => {
      cleanupDragHandlers()
      themeObserver.disconnect()
      onViewportReady?.(null)
      renderer.kill()
      sigmaRef.current = null
    }
  }, [input, onSelect, onViewportReady])

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-[480px] w-full rounded-md border border-border bg-card'}
      role="application"
      aria-label={ariaLabel ?? input.ariaLabel ?? 'Sigma readonly graph'}
    />
  )
}

export type { ShowcaseKgRendererInput, ShowcaseSemanticNetworkRendererInput }
