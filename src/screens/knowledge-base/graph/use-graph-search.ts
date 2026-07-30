import { useMemo } from 'react'

import type { GovernedGraphProjection, GraphLens } from './graph-types'

export type GraphFilters = {
  query: string
  kind: string
  tier: string
  authorityRole: string
  governanceState: string
}

export function useGraphSearch(
  projection: GovernedGraphProjection,
  filters: GraphFilters,
) {
  return useMemo(() => {
    return filterGraphNodes(projection, filters)
  }, [filters, projection.nodes])
}

export function filterGraphNodes(
  projection: GovernedGraphProjection,
  filters: GraphFilters,
) {
  const query = filters.query.trim().toLowerCase()
  return projection.nodes.filter((node) => {
    if (filters.kind !== 'all' && node.kind !== filters.kind) return false
    if (filters.tier !== 'all' && node.semanticTier !== filters.tier) return false
    if (
      filters.authorityRole !== 'all' &&
      node.authorityRole !== filters.authorityRole
    ) {
      return false
    }
    if (
      filters.governanceState !== 'all' &&
      node.governanceState !== filters.governanceState
    ) {
      return false
    }
    if (!query) return true
    return [
      node.label,
      node.summary,
      node.sourceLocator,
      node.sourceTitle,
      node.authorityRole,
      node.semanticTier,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
}

export function defaultLensForEntry(entryTab: 'legal' | 'governance'): GraphLens {
  return entryTab === 'governance' ? 'conflict' : 'evidence'
}
