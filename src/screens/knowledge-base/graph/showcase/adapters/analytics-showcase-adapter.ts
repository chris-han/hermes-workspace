import {
  ASIMOV_CATEGORICAL_SERIES_ORDER,
  ASIMOV_VISUALIZATION_SWATCH_VALUES,
} from '../visualization/asimov-visualization-swatch-values'
import type {
  AnalyticsShowcaseSubmode,
  ShowcaseAnalyticsFixture,
  ShowcaseInspectorModel,
  ShowcaseMetric,
} from '../semantica-showcase-types'
import {  adaptKgFixture } from './kg-showcase-adapter'
import type {KgShowcaseAdapterResult} from './kg-showcase-adapter';

/**
 * Deterministic Asimov categorical palette for community coloring, REBOUND to
 * the canonical token surface (`asimov-visualization-swatch-values.ts`, the
 * DOM-free mirror of `asimov-visualization-swatches.css`) per the
 * visualization theme refactor W2 — hex values no longer live in this
 * adapter. Mapping policy (§6.2): the sorted community-id list indexes the
 * canonical series range in order, so dataset/submode switches never recolor
 * the same community identity.
 */
export const ASIMOV_COMMUNITY_PALETTE: readonly string[] = ASIMOV_CATEGORICAL_SERIES_ORDER.map(
  (swatch) => ASIMOV_VISUALIZATION_SWATCH_VALUES[swatch],
)

const UNASSIGNED_COMMUNITY_COLOR = '#64748b'

export type AnalyticsShowcaseAdapterResult =
  | {
      kind: 'centrality'
      rankings: { nodeId: string; score: number; rank: number }[]
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }
  | {
      kind: 'communities'
      graph: KgShowcaseAdapterResult['readonlyInput']
      communities: { id: string | number; nodeIds: string[] }[]
      assignments: Record<string, string | number>
      /** Deterministic community-id → Asimov categorical color mapping. */
      communityColors: Record<string, string>
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }

export function adaptAnalyticsFixture(
  fixture: ShowcaseAnalyticsFixture,
  submode: AnalyticsShowcaseSubmode,
  selection?: string | null,
): AnalyticsShowcaseAdapterResult {
  if (submode === 'centrality') {
    const rankings = [...(fixture.centrality?.rankings ?? [])].sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      return left.nodeId.localeCompare(right.nodeId)
    }).map((ranking, index) => ({ ...ranking, rank: index + 1 }))
    const selectedRanking = selection ? rankings.find((ranking) => ranking.nodeId === selection) : undefined
    return {
      kind: 'centrality',
      rankings,
      inspector: selectedRanking
        ? {
            title: selectedRanking.nodeId,
            subtitle: fixture.centrality?.measure ?? 'degree',
            emptyLabel: '',
            fields: [
              { label: 'node', value: selectedRanking.nodeId, mono: true },
              { label: 'rank', value: String(selectedRanking.rank) },
              { label: 'score', value: selectedRanking.score.toFixed(3) },
              { label: 'measure', value: fixture.centrality?.measure ?? 'degree' },
            ],
          }
        : {
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

  const assignments = fixture.communities?.assignments ?? {}
  const communities = [...(fixture.communities?.communities ?? [])].sort((left, right) => {
    const leftKey = String(left.id)
    const rightKey = String(right.id)
    return leftKey.localeCompare(rightKey)
  })
  // Deterministic community → Asimov categorical color mapping, indexed by the
  // sorted community-id order. The Sigma readonly core renders `node.color`
  // directly (`group` alone would leave every node gray), so the assignment
  // must be applied to `node.color` before handoff; `group` keeps the
  // community id as semantic metadata.
  const communityColors: Record<string, string> = {}
  communities.forEach((community, index) => {
    communityColors[String(community.id)] =
      ASIMOV_COMMUNITY_PALETTE[index % ASIMOV_COMMUNITY_PALETTE.length]!
  })
  const baseGraph = adaptKgFixture(fixture.graph).readonlyInput
  const graph: KgShowcaseAdapterResult['readonlyInput'] = {
    ...baseGraph,
    nodes: baseGraph.nodes.map((node) => {
      const assignment = assignments[node.id]
      if (assignment === undefined) {
        return { ...node, color: UNASSIGNED_COMMUNITY_COLOR }
      }
      const key = String(assignment)
      return {
        ...node,
        group: `community:${key}`,
        color: communityColors[key] ?? UNASSIGNED_COMMUNITY_COLOR,
      }
    }),
  }
  const selectedNode = selection ? graph.nodes.find((node) => node.id === selection) : undefined
  return {
    kind: 'communities',
    graph,
    communities,
    assignments,
    communityColors,
    inspector: selectedNode
      ? {
          title: selectedNode.label,
          subtitle: `Community ${String(assignments[selectedNode.id] ?? '—')}`,
          emptyLabel: '',
          fields: [
            { label: 'id', value: selectedNode.id, mono: true },
            { label: 'community', value: String(assignments[selectedNode.id] ?? '—') },
            { label: 'color', value: selectedNode.color ?? UNASSIGNED_COMMUNITY_COLOR, mono: true },
          ],
        }
      : {
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
