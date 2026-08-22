import type {
  ShowcaseInspectorModel,
  ShowcaseMetric,
  ShowcaseTemporalFixture,
  TemporalShowcaseSubmode,
} from '../semantica-showcase-types'

export type TemporalShowcaseAdapterResult =
  | {
      kind: 'timeline'
      events: Array<{ id: string; timestamp: string; type: string; label: string; entityId?: string }>
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }
  | {
      kind: 'version-history'
      versions: Array<{ id: string; timestamp: string; label: string; changes?: string }>
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }
  | {
      kind: 'temporal-dashboard'
      entities: Array<{ id: string; type: string; label: string; start?: string; end?: string }>
      relationships: Array<{ id: string; source: string; target: string; type: string; timestamp?: string }>
      timestamps: Record<string, string[]>
      metricsSeries: ShowcaseTemporalFixture['dashboard'] extends infer Dashboard
        ? Dashboard extends { metrics?: infer Series }
          ? Series
          : never
        : never
      /** §8.1 diagnostics: relationships dropped because an endpoint is absent. */
      diagnostics: { droppedRelationshipIds: string[] }
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }
  | {
      kind: 'network-evolution'
      nodes: Array<{ id: string; label: string; type: string }>
      edges: Array<{ id: string; source: string; target: string; type: string }>
      timestamps: Record<string, string[]>
      /** §8.1 diagnostics: relationships dropped because an endpoint is absent. */
      diagnostics: { droppedRelationshipIds: string[] }
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }

export function adaptTemporalFixture(
  fixture: ShowcaseTemporalFixture,
  submode: TemporalShowcaseSubmode,
): TemporalShowcaseAdapterResult {
  if (submode === 'timeline') {
    const events = [...(fixture.timeline?.events ?? [])].sort((left, right) => {
      if (left.timestamp !== right.timestamp) return left.timestamp.localeCompare(right.timestamp)
      return left.id.localeCompare(right.id)
    })
    return {
      kind: 'timeline',
      events,
      inspector: {
        title: 'Timeline',
        subtitle: 'Temporal event stream',
        emptyLabel: 'No event selected',
        fields: events.slice(0, 3).map((event) => ({
          label: event.id,
          value: `${event.timestamp} · ${event.type}`,
        })),
      },
      metrics: [
        { label: 'Events', value: String(events.length) },
        { label: 'Unique timestamps', value: String(new Set(events.map((event) => event.timestamp)).size) },
      ],
    }
  }

  if (submode === 'version-history') {
    const versions = [...(fixture.versionHistory?.versions ?? [])].sort((left, right) => {
      if (left.timestamp !== right.timestamp) return left.timestamp.localeCompare(right.timestamp)
      return left.id.localeCompare(right.id)
    })
    return {
      kind: 'version-history',
      versions,
      inspector: {
        title: 'Version History',
        subtitle: 'Notebook-pinned version comparisons',
        emptyLabel: 'No version selected',
        fields: versions.slice(0, 3).map((version) => ({
          label: version.id,
          value: `${version.timestamp} · ${version.changes ?? ''}`,
        })),
      },
      metrics: [{ label: 'Versions', value: String(versions.length) }],
    }
  }

  if (submode === 'temporal-dashboard') {
    const dashboard = fixture.dashboard ?? { entities: [], relationships: [], timestamps: {} }
    const metricsSeries = dashboard.metrics ?? []
    // §8.1: dangling relationships are dropped deterministically and surfaced
    // in diagnostics; adapters never fabricate endpoints.
    const entityIds = new Set(dashboard.entities.map((entity) => entity.id))
    const keptRelationships = dashboard.relationships.filter(
      (relationship) => entityIds.has(relationship.source) && entityIds.has(relationship.target),
    )
    const droppedRelationshipIds = dashboard.relationships
      .filter((relationship) => !entityIds.has(relationship.source) || !entityIds.has(relationship.target))
      .map((relationship) => relationship.id)
      .sort()
    return {
      kind: 'temporal-dashboard',
      entities: [...dashboard.entities].sort((left, right) => left.id.localeCompare(right.id)),
      relationships: [...keptRelationships].sort((left, right) => left.id.localeCompare(right.id)),
      timestamps: dashboard.timestamps,
      metricsSeries,
      diagnostics: { droppedRelationshipIds },
      inspector: {
        title: 'Temporal Dashboard',
        subtitle: 'Lifecycle and metric overview',
        emptyLabel: 'Dashboard rows are derived from the notebook sample',
        fields: [
          { label: 'entities', value: String(dashboard.entities.length) },
          { label: 'relationships', value: String(keptRelationships.length) },
          { label: 'series', value: String(metricsSeries.length) },
          { label: 'dropped', value: String(droppedRelationshipIds.length) },
        ],
      },
      metrics: [
        { label: 'Entities', value: String(dashboard.entities.length) },
        { label: 'Relationships', value: String(keptRelationships.length) },
        { label: 'Metric series', value: String(metricsSeries.length) },
      ],
    }
  }

  const evolution = fixture.networkEvolution ?? { entities: [], relationships: [], timestamps: {} }
  const evolutionEntityIds = new Set(evolution.entities.map((entity) => entity.id))
  const keptEvolutionRelationships = evolution.relationships.filter(
    (relationship) => evolutionEntityIds.has(relationship.source) && evolutionEntityIds.has(relationship.target),
  )
  const droppedEvolutionRelationshipIds = evolution.relationships
    .filter((relationship) => !evolutionEntityIds.has(relationship.source) || !evolutionEntityIds.has(relationship.target))
    .map((relationship) => relationship.id)
    .sort()
  return {
    kind: 'network-evolution',
    nodes: [...evolution.entities].sort((left, right) => left.id.localeCompare(right.id)).map((entity) => ({
      id: entity.id,
      label: entity.label,
      type: entity.type,
    })),
    edges: [...keptEvolutionRelationships].sort((left, right) => left.id.localeCompare(right.id)).map((relationship) => ({
      id: relationship.id,
      source: relationship.source,
      target: relationship.target,
      type: relationship.type,
    })),
    timestamps: evolution.timestamps,
    diagnostics: { droppedRelationshipIds: droppedEvolutionRelationshipIds },
    inspector: {
      title: 'Network Evolution',
      subtitle: 'Temporal graph evolution sample',
      emptyLabel: 'No node selected',
      fields: [
        { label: 'frames', value: String(Object.keys(evolution.timestamps).length) },
        { label: 'nodes', value: String(evolution.entities.length) },
        { label: 'edges', value: String(keptEvolutionRelationships.length) },
        { label: 'dropped', value: String(droppedEvolutionRelationshipIds.length) },
      ],
    },
    metrics: [
      { label: 'Nodes', value: String(evolution.entities.length) },
      { label: 'Edges', value: String(keptEvolutionRelationships.length) },
    ],
  }
}
