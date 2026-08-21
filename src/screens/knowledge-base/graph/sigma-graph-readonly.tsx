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
import Sigma from 'sigma'

import type { ShowcaseKgRendererInput, ShowcaseSemanticNetworkRendererInput } from './showcase/semantica-showcase-types'

export type SigmaGraphReadonlyNode = {
  id: string
  label: string
  group?: string
  size?: number
  color?: string
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
}

export type SigmaGraphReadonlySelection =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | null

export interface SigmaGraphReadonlyInput {
  nodes: SigmaGraphReadonlyNode[]
  edges: SigmaGraphReadonlyEdge[]
  selection?: SigmaGraphReadonlySelection
  highlightedNodeIds?: string[]
  highlightedEdgeIds?: string[]
  positions?: Record<string, { x: number; y: number }>
  /** Display label used by tests and accessibility text. */
  ariaLabel?: string
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
      label: edge.label ?? '',
      size: edge.size ?? 1,
      color: edge.color ?? '#cbd5e1',
    })
  })
  return graph
}

export function SigmaGraphReadonly({
  input,
  onSelect,
  className,
  ariaLabel,
}: {
  input: SigmaGraphReadonlyInput
  onSelect?: (selection: SigmaGraphReadonlySelection) => void
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
    const renderer = new Sigma(graph, containerRef.current, {
      renderLabels: true,
      labelColor: { color: resolveLabelColor() },
      edgeLabelColor: { color: resolveLabelColor() },
      allowInvalidContainer: true,
    })
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
    if (onSelect) {
      renderer.on('clickNode', ({ node }) => onSelect({ type: 'node', id: node }))
      renderer.on('clickEdge', ({ edge }) => onSelect({ type: 'edge', id: edge }))
    }
    sigmaRef.current = renderer
    return () => {
      themeObserver.disconnect()
      renderer.kill()
      sigmaRef.current = null
    }
  }, [input, onSelect])

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
