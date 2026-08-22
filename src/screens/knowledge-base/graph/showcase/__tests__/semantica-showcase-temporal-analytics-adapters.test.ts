import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { adaptKgFixture } from '../adapters/kg-showcase-adapter'
import { adaptTemporalFixture } from '../adapters/temporal-showcase-adapter'
import { adaptAnalyticsFixture } from '../adapters/analytics-showcase-adapter'
import { getDataset } from '../semantica-showcase-dataset'
import type {
  ShowcaseAnalyticsFixture,
  ShowcaseTemporalFixture,
} from '../semantica-showcase-types'

const SUITE = '03-Complete-Visualization-Suite'
const TEMPORAL_KG = '10-Temporal-Knowledge-Graphs'

function suiteTemporal(): ShowcaseTemporalFixture {
  const fixture = getDataset(SUITE).temporal
  if (!fixture) throw new Error(`${SUITE}: temporal payload missing`)
  return fixture
}

function suiteAnalytics(): ShowcaseAnalyticsFixture {
  const fixture = getDataset(SUITE).analytics
  if (!fixture) throw new Error(`${SUITE}: analytics payload missing`)
  return fixture
}

describe('temporal showcase adapter — timeline', () => {
  it('orders events chronologically with stable ID tie-break and deterministic bounds', () => {
    const result = adaptTemporalFixture(suiteTemporal(), 'timeline')
    expect(result.kind).toBe('timeline')
    if (result.kind !== 'timeline') return
    const timestamps = result.events.map((event) => event.timestamp)
    const sorted = [...timestamps].sort()
    expect(timestamps).toEqual(sorted)
    // Same-timestamp ties are broken by event id (locale order).
    for (let index = 1; index < result.events.length; index += 1) {
      const prev = result.events[index - 1]!
      const next = result.events[index]!
      if (prev.timestamp === next.timestamp) {
        expect(prev.id.localeCompare(next.id)).toBeLessThan(0)
      }
    }
    // Time bounds are deterministic: first/last elements of the sorted stream.
    expect(result.events[0]!.timestamp).toBe(sorted[0])
    expect(result.events[result.events.length - 1]!.timestamp).toBe(sorted[sorted.length - 1])
  })

  it('is deterministic regardless of fixture event order', () => {
    const base = suiteTemporal()
    const shuffled: ShowcaseTemporalFixture = {
      ...base,
      timeline: { events: [...(base.timeline?.events ?? [])].reverse() },
    }
    const forward = adaptTemporalFixture(base, 'timeline')
    const reversed = adaptTemporalFixture(shuffled, 'timeline')
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })
})

describe('temporal showcase adapter — version-history', () => {
  it('orders versions chronologically on the temporal-KG dataset', () => {
    const fixture = getDataset(TEMPORAL_KG).temporal
    if (!fixture) throw new Error(`${TEMPORAL_KG}: temporal payload missing`)
    const result = adaptTemporalFixture(fixture, 'version-history')
    expect(result.kind).toBe('version-history')
    if (result.kind !== 'version-history') return
    expect(result.versions.map((version) => version.id)).toEqual(['v1.0', 'v2.0', 'v3.0'])
    const timestamps = result.versions.map((version) => version.timestamp)
    expect(timestamps).toEqual([...timestamps].sort())
    expect(result.versions.every((version) => typeof version.changes === 'string')).toBe(true)
  })
})

describe('temporal showcase adapter — temporal-dashboard', () => {
  it('aligns metric series with the dashboard timestamps and keeps entities ID-sorted', () => {
    const result = adaptTemporalFixture(suiteTemporal(), 'temporal-dashboard')
    expect(result.kind).toBe('temporal-dashboard')
    if (result.kind !== 'temporal-dashboard') return
    const entityIds = result.entities.map((entity) => entity.id)
    expect(entityIds).toEqual([...entityIds].sort())
    // Series alignment: every series point timestamp is a known frame and all
    // series share the same length.
    const frames = new Set(Object.values(result.timestamps).flat())
    const series = result.metricsSeries ?? []
    expect(series.length).toBeGreaterThan(0)
    const lengths = new Set(series.map((item) => item.values.length))
    expect(lengths.size).toBe(1)
    for (const item of series) {
      for (const point of item.values) {
        expect(frames.has(point.timestamp)).toBe(true)
      }
    }
    // No dangling relationships in the checked-in fixture.
    expect(result.diagnostics.droppedRelationshipIds).toEqual([])
  })

  it('drops dangling relationships deterministically and surfaces diagnostics', () => {
    const fixture: ShowcaseTemporalFixture = {
      dashboard: {
        entities: [
          { id: 'b', type: 'T', label: 'B' },
          { id: 'a', type: 'T', label: 'A' },
        ],
        relationships: [
          { id: 'r2', source: 'a', target: 'ghost', type: 'rel' },
          { id: 'r1', source: 'a', target: 'b', type: 'rel' },
          { id: 'r3', source: 'ghost', target: 'b', type: 'rel' },
        ],
        timestamps: {},
      },
    }
    const result = adaptTemporalFixture(fixture, 'temporal-dashboard')
    if (result.kind !== 'temporal-dashboard') throw new Error('unexpected kind')
    expect(result.relationships.map((relationship) => relationship.id)).toEqual(['r1'])
    expect(result.diagnostics.droppedRelationshipIds).toEqual(['r2', 'r3'])
    expect(result.entities.map((entity) => entity.id)).toEqual(['a', 'b'])
  })
})

describe('temporal showcase adapter — network-evolution', () => {
  it('keeps stable node IDs and frame membership across frames', () => {
    const result = adaptTemporalFixture(suiteTemporal(), 'network-evolution')
    expect(result.kind).toBe('network-evolution')
    if (result.kind !== 'network-evolution') return
    const nodeIds = result.nodes.map((node) => node.id)
    expect(nodeIds).toEqual([...nodeIds].sort())
    // Frame membership: every node has a frame list, every frame is sorted,
    // and membership only ever references known node ids.
    expect(Object.keys(result.timestamps).sort()).toEqual([...nodeIds].sort())
    for (const frames of Object.values(result.timestamps)) {
      expect(frames).toEqual([...frames].sort())
    }
    // Edges reference stable node ids on both ends.
    const nodeIdSet = new Set(nodeIds)
    for (const edge of result.edges) {
      expect(nodeIdSet.has(edge.source)).toBe(true)
      expect(nodeIdSet.has(edge.target))
    }
    expect(result.diagnostics.droppedRelationshipIds).toEqual([])
  })

  it('drops dangling evolution relationships deterministically with diagnostics', () => {
    const fixture: ShowcaseTemporalFixture = {
      networkEvolution: {
        entities: [{ id: 'a', type: 'T', label: 'A' }],
        relationships: [
          { id: 'r9', source: 'a', target: 'gone', type: 'rel' },
          { id: 'r1', source: 'gone', target: 'a', type: 'rel' },
        ],
        timestamps: { a: ['2024-01-01'] },
      },
    }
    const result = adaptTemporalFixture(fixture, 'network-evolution')
    if (result.kind !== 'network-evolution') throw new Error('unexpected kind')
    expect(result.edges).toEqual([])
    expect(result.diagnostics.droppedRelationshipIds).toEqual(['r1', 'r9'])
  })

  it('invalidates selection when the entity is absent in the new submode', () => {
    // §8.1: adapter outputs expose exactly the ids valid for the submode; a
    // selection from another submode cannot resolve against them.
    const fixture: ShowcaseTemporalFixture = {
      timeline: {
        events: [
          { id: 'ev-1', timestamp: '2024-01-01', type: 'T', label: 'E1', entityId: 'ghost' },
        ],
      },
      networkEvolution: {
        entities: [{ id: 'a', type: 'T', label: 'A' }],
        relationships: [],
        timestamps: { a: ['2024-01-01'] },
      },
    }
    const timeline = adaptTemporalFixture(fixture, 'timeline')
    const evolution = adaptTemporalFixture(fixture, 'network-evolution')
    if (timeline.kind !== 'timeline' || evolution.kind !== 'network-evolution') {
      throw new Error('unexpected kinds')
    }
    expect(timeline.events[0]!.entityId).toBe('ghost')
    const evolutionIds = new Set(evolution.nodes.map((node) => node.id))
    expect(evolutionIds.has('ghost')).toBe(false)
  })
})

describe('analytics showcase adapter — centrality', () => {
  it('sorts rankings score-descending with a stable nodeId tie-break', () => {
    const result = adaptAnalyticsFixture(suiteAnalytics(), 'centrality')
    expect(result.kind).toBe('centrality')
    if (result.kind !== 'centrality') return
    expect(result.rankings.map((rank) => rank.nodeId)).toEqual(['e1', 'e3', 'e2', 'e4'])
    for (let index = 1; index < result.rankings.length; index += 1) {
      const prev = result.rankings[index - 1]!
      const next = result.rankings[index]!
      expect(prev.score).toBeGreaterThanOrEqual(next.score)
      if (prev.score === next.score) {
        expect(prev.nodeId.localeCompare(next.nodeId)).toBeLessThan(0)
      }
    }
  })

  it('is deterministic regardless of fixture ranking order', () => {
    const base = suiteAnalytics()
    const shuffled: ShowcaseAnalyticsFixture = {
      ...base,
      centrality: {
        measure: base.centrality?.measure ?? 'degree',
        rankings: [...(base.centrality?.rankings ?? [])].reverse(),
      },
    }
    const forward = adaptAnalyticsFixture(base, 'centrality')
    const reversed = adaptAnalyticsFixture(shuffled, 'centrality')
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward))
  })
})

describe('analytics showcase adapter — communities', () => {
  it('stable-sorts community ids and preserves member order', () => {
    const base = suiteAnalytics()
    const shuffled: ShowcaseAnalyticsFixture = {
      ...base,
      communities: {
        assignments: { ...(base.communities?.assignments ?? {}) },
        communities: [...(base.communities?.communities ?? [])].reverse(),
      },
    }
    const forward = adaptAnalyticsFixture(base, 'communities')
    const reversed = adaptAnalyticsFixture(shuffled, 'communities')
    if (forward.kind !== 'communities' || reversed.kind !== 'communities') {
      throw new Error('unexpected kinds')
    }
    expect(reversed.communities.map((community) => String(community.id))).toEqual(
      forward.communities.map((community) => String(community.id)),
    )
    expect(forward.communities.map((community) => String(community.id))).toEqual(['0', '1'])
    expect(forward.communities[0]!.nodeIds).toEqual(['e1', 'e2'])
  })

  it('reuses the source graph node/edge identity for the community overlay', () => {
    const fixture = suiteAnalytics()
    const result = adaptAnalyticsFixture(fixture, 'communities')
    if (result.kind !== 'communities') throw new Error('unexpected kind')
    const direct = adaptKgFixture(fixture.graph)
    expect(result.graph.nodes.map((node) => node.id)).toEqual(
      direct.readonlyInput.nodes.map((node) => node.id),
    )
    expect(result.graph.edges.map((edge) => edge.id)).toEqual(
      direct.readonlyInput.edges.map((edge) => edge.id),
    )
    expect(result.graph.nodes.map((node) => node.id)).toEqual(
      fixture.graph.entities.map((entity) => entity.id),
    )
    // Every assignment references a real overlay node.
    const nodeIds = new Set(result.graph.nodes.map((node) => node.id))
    for (const nodeId of Object.keys(result.assignments)) {
      expect(nodeIds.has(nodeId)).toBe(true)
    }
  })

  it('resets selection across submodes: models expose disjoint id namespaces', () => {
    const fixture = suiteAnalytics()
    const centrality = adaptAnalyticsFixture(fixture, 'centrality')
    const communities = adaptAnalyticsFixture(fixture, 'communities')
    if (centrality.kind !== 'centrality' || communities.kind !== 'communities') {
      throw new Error('unexpected kinds')
    }
    // Community ids are not node ids: a stale community selection cannot
    // resolve against the centrality model and vice versa.
    const communityIds = new Set(communities.communities.map((community) => String(community.id)))
    const rankedNodeIds = new Set(centrality.rankings.map((rank) => rank.nodeId))
    for (const id of communityIds) {
      expect(rankedNodeIds.has(id)).toBe(false)
    }
  })
})

describe('analytics showcase adapter — §10.3 communities semantic regression', () => {
  it('binds the communities submode to visualize_community_structure semantics', () => {
    // The checked-in manifest must record the real source behavior:
    // AnalyticsVisualizer.visualize_community_structure delegates to
    // KGVisualizer.visualize_communities (plan §1.3). If a fixture is ever
    // regenerated without this binding, this test fails.
    const manifest = getDataset(SUITE).manifest
    const analyticsFile = manifest.files.find((file) => file.file === 'analytics.json')
    expect(analyticsFile, 'analytics.json manifest entry missing').toBeDefined()
    const params = analyticsFile!.derivationParameters
    expect(params.derivationKind ?? analyticsFile!.derivationKind).toBe('analytics-normalized')
    expect(String(params.source_behavior)).toMatch(
      /AnalyticsVisualizer\.visualize_community_structure delegates to KGVisualizer\.visualize_communities/,
    )
  })

  it('never depends on a fictitious AnalyticsVisualizer.visualize_communities API', () => {
    // Static guard: the adapter module must not reference the stale notebook
    // call spelling as if it were a real AnalyticsVisualizer method.
    const adapterSource = readFileSync(
      new URL('../adapters/analytics-showcase-adapter.ts', import.meta.url),
      'utf8',
    )
    expect(adapterSource).not.toMatch(/visualize_communities/)
    expect(adapterSource).not.toMatch(/AnalyticsVisualizer/)
  })

  it('follows community-structure behavior: partition over the KG community overlay', () => {
    const fixture = suiteAnalytics()
    const result = adaptAnalyticsFixture(fixture, 'communities')
    if (result.kind !== 'communities') throw new Error('unexpected kind')
    // KGVisualizer.visualize_communities semantics: the source KG rendered
    // with a community partition overlay — adapter consumes the `communities`
    // payload (assignments + partition) and the KG adapter for the graph.
    expect(result.inspector.title).toBe('Community Structure')
    expect(result.assignments).toEqual(fixture.communities?.assignments)
    const memberUnion = result.communities.flatMap((community) => community.nodeIds).sort()
    expect(memberUnion).toEqual(Object.keys(fixture.communities?.assignments ?? {}).sort())
    // Every member belongs to exactly its assigned community.
    for (const community of result.communities) {
      for (const nodeId of community.nodeIds) {
        expect(String(result.assignments[nodeId])).toBe(String(community.id))
      }
    }
  })
})
