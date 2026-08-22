import { adaptKgFixture, type KgShowcaseAdapterResult } from './kg-showcase-adapter'
import type {
  ShowcaseAnalyticsFixture,
  ShowcaseInspectorModel,
  ShowcaseMetric,
  AnalyticsShowcaseSubmode,
} from '../semantica-showcase-types'

export type AnalyticsShowcaseAdapterResult =
  | {
      kind: 'centrality'
      rankings: Array<{ nodeId: string; score: number }>
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }
  | {
      kind: 'communities'
      graph: KgShowcaseAdapterResult['readonlyInput']
      communities: Array<{ id: string | number; nodeIds: string[] }>
      assignments: Record<string, string | number>
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }

export function adaptAnalyticsFixture(
  fixture: ShowcaseAnalyticsFixture,
  submode: AnalyticsShowcaseSubmode,
): AnalyticsShowcaseAdapterResult {
  if (submode === 'centrality') {
    const rankings = [...(fixture.centrality?.rankings ?? [])].sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      return left.nodeId.localeCompare(right.nodeId)
    })
    return {
      kind: 'centrality',
      rankings,
      inspector: {
        title: 'Centrality',
        subtitle: fixture.centrality?.measure ?? 'degree',
        emptyLabel: 'No node selected',
        fields: rankings.slice(0, 3).map((rank) => ({
          label: rank.nodeId,
          value: rank.score.toFixed(3),
        })),
      },
      metrics: [
        { label: 'Ranked nodes', value: String(rankings.length) },
        { label: 'Measure', value: fixture.centrality?.measure ?? 'degree' },
      ],
    }
  }

  const graphResult = adaptKgFixture(fixture.graph)
  const communities = [...(fixture.communities?.communities ?? [])].sort((left, right) => {
    const leftKey = String(left.id)
    const rightKey = String(right.id)
    return leftKey.localeCompare(rightKey)
  })
  return {
    kind: 'communities',
    graph: graphResult.readonlyInput,
    communities,
    assignments: fixture.communities?.assignments ?? {},
    inspector: {
      title: 'Community Structure',
      subtitle: 'Notebook community detection sample',
      emptyLabel: 'No community selected',
      fields: [
        { label: 'communities', value: String(communities.length) },
        { label: 'nodes', value: String(fixture.graph.entities.length) },
      ],
    },
    metrics: [
      { label: 'Communities', value: String(communities.length) },
      { label: 'Nodes', value: String(fixture.graph.entities.length) },
      { label: 'Edges', value: String(fixture.graph.relationships.length) },
    ],
  }
}
