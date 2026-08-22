import type {
  ShowcaseGraphModel,
  ShowcaseInspectorModel,
  ShowcaseMetric,
  ShowcaseTemporalFixture,
  TemporalShowcaseSubmode,
} from '../semantica-showcase-types'

export type TemporalTimelineLane = {
  type: string
  events: Array<{ id: string; timestamp: string; label: string; entityId?: string }>
}

export type TemporalDashboardLifeline = {
  id: string
  label: string
  type: string
  start: string
  end: string
}

export type TemporalDashboardActivityPoint = {
  timestamp: string
  activeEntities: number
  activeRelationships: number
}

export type TemporalEvolutionFrameMembership = Record<
  string,
  { nodeIds: string[]; edgeIds: string[] }
>

export type TemporalShowcaseAdapterResult =
  | {
      kind: 'timeline'
      events: Array<{ id: string; timestamp: string; type: string; label: string; entityId?: string }>
      /** Notebook-pinned encoding: one categorical lane per event type. */
      lanes: TemporalTimelineLane[]
      timeBounds: { start: string; end: string }
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }
  | {
      kind: 'version-history'
      versions: Array<{ id: string; timestamp: string; label: string; changes?: string }>
      timeBounds: { start: string; end: string }
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }
  | {
      kind: 'temporal-dashboard'
      entities: Array<{ id: string; type: string; label: string; start?: string; end?: string }>
      relationships: Array<{ id: string; source: string; target: string; type: string; timestamp?: string }>
      timestamps: Record<string, string[]>
      /** Gantt-style entity lifelines (ranged bars by start/end). */
      lifelines: TemporalDashboardLifeline[]
      /**
       * Pinned upstream dual series: a relationship counts as active at `t`
       * iff BOTH endpoints are active at `t` (approximation when strict
       * relationship timestamps are unavailable).
       */
      activity: TemporalDashboardActivityPoint[]
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
      /** Sorted union of all entity timestamp values (normative). */
      frameTimes: string[]
      /** Full evolution graph; positions are NOT included (owned by the shared layout helper). */
      graph: ShowcaseGraphModel
      /** Normative membership: node active at t <=> t ∈ timestamps[nodeId]; edge active <=> both endpoints active. */
      frameMembership: TemporalEvolutionFrameMembership
      /** §8.1 diagnostics: relationships dropped because an endpoint is absent. */
      diagnostics: { droppedRelationshipIds: string[] }
      inspector: ShowcaseInspectorModel
      metrics: ShowcaseMetric[]
    }

function sortedTimeBounds(timestamps: string[]): { start: string; end: string } {
  const sorted = [...timestamps].sort()
  return { start: sorted[0] ?? '', end: sorted[sorted.length - 1] ?? '' }
}

export function adaptTemporalFixture(
  fixture: ShowcaseTemporalFixture,
  submode: TemporalShowcaseSubmode,
  selection?: string | null,
): TemporalShowcaseAdapterResult {
  if (submode === 'timeline') {
    const events = [...(fixture.timeline?.events ?? [])].sort((left, right) => {
      if (left.timestamp !== right.timestamp) return left.timestamp.localeCompare(right.timestamp)
      return left.id.localeCompare(right.id)
    })
    // Lane ordering: first-appearance chronological, then type-name tie-break.
    const laneByType = new Map<string, TemporalTimelineLane>()
    for (const event of events) {
      const lane = laneByType.get(event.type) ?? { type: event.type, events: [] }
      lane.events.push({ id: event.id, timestamp: event.timestamp, label: event.label, entityId: event.entityId })
      laneByType.set(event.type, lane)
    }
    const lanes = [...laneByType.values()].sort((left, right) => {
      const leftFirst = left.events[0]?.timestamp ?? ''
      const rightFirst = right.events[0]?.timestamp ?? ''
      if (leftFirst !== rightFirst) return leftFirst.localeCompare(rightFirst)
      return left.type.localeCompare(right.type)
    })
    const selectedEvent = selection ? events.find((event) => event.id === selection) : undefined
    return {
      kind: 'timeline',
      events,
      lanes,
      timeBounds: sortedTimeBounds(events.map((event) => event.timestamp)),
      inspector: selectedEvent
        ? {
            title: selectedEvent.label,
            subtitle: selectedEvent.type,
            emptyLabel: '',
            fields: [
              { label: 'id', value: selectedEvent.id, mono: true },
              { label: 'timestamp', value: selectedEvent.timestamp, mono: true },
              { label: 'type', value: selectedEvent.type },
              ...(selectedEvent.entityId ? [{ label: 'entity', value: selectedEvent.entityId, mono: true }] : []),
            ],
          }
        : {
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
        { label: 'Lanes', value: String(lanes.length) },
      ],
    }
  }

  if (submode === 'version-history') {
    const versions = [...(fixture.versionHistory?.versions ?? [])].sort((left, right) => {
      if (left.timestamp !== right.timestamp) return left.timestamp.localeCompare(right.timestamp)
      return left.id.localeCompare(right.id)
    })
    const selectedVersion = selection ? versions.find((version) => version.id === selection) : undefined
    return {
      kind: 'version-history',
      versions,
      timeBounds: sortedTimeBounds(versions.map((version) => version.timestamp)),
      inspector: selectedVersion
        ? {
            title: selectedVersion.label,
            subtitle: selectedVersion.timestamp,
            emptyLabel: '',
            fields: [
              { label: 'id', value: selectedVersion.id, mono: true },
              { label: 'timestamp', value: selectedVersion.timestamp, mono: true },
              ...(selectedVersion.changes ? [{ label: 'changes', value: selectedVersion.changes }] : []),
            ],
          }
        : {
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

    const frameTimes = [...new Set(Object.values(dashboard.timestamps).flat())].sort()
    const globalBounds = sortedTimeBounds(frameTimes)
    const entities = [...dashboard.entities].sort((left, right) => left.id.localeCompare(right.id))
    const lifelines: TemporalDashboardLifeline[] = entities.map((entity) => {
      const entityFrames = sortedTimeBounds(dashboard.timestamps[entity.id] ?? [])
      return {
        id: entity.id,
        label: entity.label,
        type: entity.type,
        start: entity.start ?? (entityFrames.start || globalBounds.start),
        end: entity.end ?? (entityFrames.end || globalBounds.end),
      }
    })
    const activity: TemporalDashboardActivityPoint[] = frameTimes.map((timestamp) => {
      const activeNodeIds = new Set(
        entities
          .filter((entity) => (dashboard.timestamps[entity.id] ?? []).includes(timestamp))
          .map((entity) => entity.id),
      )
      return {
        timestamp,
        activeEntities: activeNodeIds.size,
        activeRelationships: keptRelationships.filter(
          (relationship) => activeNodeIds.has(relationship.source) && activeNodeIds.has(relationship.target),
        ).length,
      }
    })

    const selectedEntity = selection ? entities.find((entity) => entity.id === selection) : undefined
    return {
      kind: 'temporal-dashboard',
      entities,
      relationships: [...keptRelationships].sort((left, right) => left.id.localeCompare(right.id)),
      timestamps: dashboard.timestamps,
      lifelines,
      activity,
      metricsSeries,
      diagnostics: { droppedRelationshipIds },
      inspector: selectedEntity
        ? {
            title: selectedEntity.label,
            subtitle: selectedEntity.type,
            emptyLabel: '',
            fields: [
              { label: 'id', value: selectedEntity.id, mono: true },
              { label: 'type', value: selectedEntity.type },
              ...(selectedEntity.start ? [{ label: 'start', value: selectedEntity.start, mono: true }] : []),
              ...(selectedEntity.end ? [{ label: 'end', value: selectedEntity.end, mono: true }] : []),
            ],
          }
        : {
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
  const nodes = [...evolution.entities].sort((left, right) => left.id.localeCompare(right.id)).map((entity) => ({
    id: entity.id,
    label: entity.label,
    type: entity.type,
  }))
  const edges = [...keptEvolutionRelationships].sort((left, right) => left.id.localeCompare(right.id)).map((relationship) => ({
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    type: relationship.type,
  }))
  const frameTimes = [...new Set(Object.values(evolution.timestamps).flat())].sort()
  const frameMembership: TemporalEvolutionFrameMembership = {}
  for (const frameTime of frameTimes) {
    const nodeIds = nodes
      .filter((node) => (evolution.timestamps[node.id] ?? []).includes(frameTime))
      .map((node) => node.id)
    const nodeIdSet = new Set(nodeIds)
    const edgeIds = edges
      .filter((edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))
      .map((edge) => edge.id)
    frameMembership[frameTime] = { nodeIds, edgeIds }
  }
  const graph: ShowcaseGraphModel = {
    nodes: nodes.map((node) => ({ id: node.id, label: node.label, group: node.type })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.type })),
  }
  const selectedNode = selection ? nodes.find((node) => node.id === selection) : undefined
  return {
    kind: 'network-evolution',
    nodes,
    edges,
    timestamps: evolution.timestamps,
    frameTimes,
    graph,
    frameMembership,
    diagnostics: { droppedRelationshipIds: droppedEvolutionRelationshipIds },
    inspector: selectedNode
      ? {
          title: selectedNode.label,
          subtitle: selectedNode.type,
          emptyLabel: '',
          fields: [
            { label: 'id', value: selectedNode.id, mono: true },
            { label: 'type', value: selectedNode.type },
            { label: 'frames', value: String((evolution.timestamps[selectedNode.id] ?? []).length) },
          ],
        }
      : {
          title: 'Network Evolution',
          subtitle: 'Temporal graph evolution sample',
          emptyLabel: 'No node selected',
          fields: [
            { label: 'frames', value: String(frameTimes.length) },
            { label: 'nodes', value: String(evolution.entities.length) },
            { label: 'edges', value: String(keptEvolutionRelationships.length) },
            { label: 'dropped', value: String(droppedEvolutionRelationshipIds.length) },
          ],
        },
    metrics: [
      { label: 'Nodes', value: String(evolution.entities.length) },
      { label: 'Edges', value: String(keptEvolutionRelationships.length) },
      { label: 'Frames', value: String(frameTimes.length) },
    ],
  }
}
