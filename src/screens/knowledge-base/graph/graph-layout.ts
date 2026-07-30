import type { GraphEdge, GraphNode, GraphScene } from './graph-types'

export type GraphPoint = { x: number; y: number }

export type GraphLayout = {
  nodes: Record<string, GraphPoint>
  edges: (GraphEdge & { sourcePoint: GraphPoint; targetPoint: GraphPoint })[]
  width: number
  height: number
}

export function buildDeterministicGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  scene: GraphScene,
): GraphLayout {
  const visibleNodes = scene.nodeIds
    .map((nodeId) => nodes.find((node) => node.id === nodeId))
    .filter((node): node is GraphNode => Boolean(node))
  const visibleEdges = scene.edgeIds
    .map((edgeId) => edges.find((edge) => edge.id === edgeId))
    .filter((edge): edge is GraphEdge => Boolean(edge))
  const positions: Record<string, GraphPoint> = {}
  const width = Math.max(760, visibleNodes.length * 118)
  const height = scene.layoutProfile === 'conflict_comparison' ? 440 : 520

  visibleNodes.forEach((node, index) => {
    const hashOffset = stableNumber(node.id) % 23
    if (scene.layoutProfile === 'authority_hierarchy') {
      positions[node.id] = {
        x: 110 + (index % 3) * 250,
        y: 74 + Math.floor(index / 3) * 128 + hashOffset,
      }
    } else if (scene.layoutProfile === 'conflict_comparison') {
      positions[node.id] = {
        x: index % 2 === 0 ? 160 : 560,
        y: 108 + Math.floor(index / 2) * 120 + hashOffset,
      }
    } else if (scene.layoutProfile === 'impact_neighborhood') {
      const angle = (index / Math.max(1, visibleNodes.length)) * Math.PI * 2
      const radius = index === 0 ? 0 : 170
      positions[node.id] = {
        x: 380 + Math.cos(angle) * radius,
        y: 250 + Math.sin(angle) * radius,
      }
    } else {
      positions[node.id] = {
        x: 96 + index * 148,
        y: 108 + (index % 2) * 154 + hashOffset,
      }
    }
  })

  return {
    nodes: positions,
    edges: visibleEdges
      .filter((edge) => positions[edge.source] && positions[edge.target])
      .map((edge) => ({
        ...edge,
        sourcePoint: positions[edge.source],
        targetPoint: positions[edge.target],
      })),
    width,
    height,
  }
}

function stableNumber(value: string) {
  return value.split('').reduce((total, char) => total + char.charCodeAt(0), 0)
}

