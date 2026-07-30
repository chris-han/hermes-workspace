import type {
  GovernedGraphProjection,
  GraphEdge,
  GraphNode,
  GraphSelection,
} from './graph-types'

export function resolveGraphSelection(
  projection: GovernedGraphProjection,
  selection: GraphSelection,
): GraphNode | GraphEdge | undefined {
  return selection.type === 'node'
    ? projection.nodes.find((node) => node.id === selection.id)
    : projection.edges.find((edge) => edge.id === selection.id)
}

export function selectionLabel(
  projection: GovernedGraphProjection,
  selection: GraphSelection,
) {
  const item = resolveGraphSelection(projection, selection)
  if (!item) return selection.id
  return 'label' in item ? item.label : item.predicateLabel
}

export function isAuthorityChangingBlocked(
  status: GovernedGraphProjection['freshness']['status'],
) {
  return status !== 'fresh'
}

