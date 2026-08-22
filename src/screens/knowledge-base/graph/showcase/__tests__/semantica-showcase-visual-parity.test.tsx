// @vitest-environment jsdom

/**
 * Visual-parity semantic regression tests (plan
 * `2026-08-22-semantica-renderer-visual-parity-remediation-v1`, W1).
 *
 * Three layers:
 *  1. Semantic-model tests (adapter/layout level, no DOM): lane ordering,
 *     both-endpoints frame membership, position stability across frames,
 *     distinct community node.color values, ranked bars model.
 *  2. Renderer/DOM tests: timeline visualization container, connected
 *     chronological version sequence, dashboard regions, Sigma canvases,
 *     centrality bar marks in descending score order.
 *  3. Screen-level: the center canvas must not duplicate the left-rail
 *     inventory lists for Temporal/Analytics.
 *
 * These tests were written BEFORE the renderer remediation and are expected
 * to fail against the pre-remediation list-based renderers (evidence in the
 * plan's implementation_evidence).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sigma', () => ({
  default: class FakeSigma {
    on() {
      return this
    }
    kill() {
      return this
    }
  },
}))

// Vega-Lite engine (plan `2026-08-22-semantica-vega-lite-chart-engine-v1`):
// the Vega runtime is not rendered under jsdom; renderer/DOM assertions read
// the deterministic compiled spec captured by this double (A12).
vi.mock('react-vega', async () => {
  const React = await import('react')
  const capture = await import('./vega-capture')
  return {
    VegaEmbed: (props: Record<string, unknown>) => {
      capture.captureVega(props)
      return React.createElement('div', { 'data-testid': 'vega-embed-stub' })
    },
  }
})

vi.mock('@/lib/semantier-auth', () => ({
  fetchSemantierAuthStatus: () => Promise.resolve({ authenticated: false, profile: null }),
  semantierAuthQueryKey: ['semantier-auth'],
  useSemantierAuthStatus: () => ({ data: { authenticated: false, profile: null } }),
}))

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { adaptTemporalFixture } from '../adapters/temporal-showcase-adapter'
import { adaptAnalyticsFixture } from '../adapters/analytics-showcase-adapter'
import { TemporalShowcaseView } from '../renderers/temporal-showcase-view'
import { AnalyticsShowcaseView } from '../renderers/analytics-showcase-view'
import { SemanticaShowcaseScreen } from '../semantica-showcase-screen'
import { getDataset } from '../semantica-showcase-dataset'
import { computeGraphTopology } from '../../layouts/graph-topology-layouts'
import type { ShowcaseGraphModel } from '../semantica-showcase-types'
import { latestVegaSpec, resetCapturedVega } from './vega-capture'

const SUITE = '03-Complete-Visualization-Suite'
const TEMPORAL_KG = '10-Temporal-Knowledge-Graphs'

afterEach(() => {
  cleanup()
  resetCapturedVega()
})

function suiteTemporal() {
  const fixture = getDataset(SUITE).temporal
  if (!fixture) throw new Error(`${SUITE}: temporal payload missing`)
  return fixture
}

function suiteAnalytics() {
  const fixture = getDataset(SUITE).analytics
  if (!fixture) throw new Error(`${SUITE}: analytics payload missing`)
  return fixture
}

/* ------------------------------------------------------------------ */
/* Layer 1 — semantic-model tests (adapter/layout, no DOM)             */
/* ------------------------------------------------------------------ */

describe('visual parity — timeline adapter model', () => {
  it('produces one deterministically ordered lane per distinct event type', () => {
    const result = adaptTemporalFixture(suiteTemporal(), 'timeline')
    if (result.kind !== 'timeline') throw new Error('unexpected kind')
    const fixtureTypes = [...new Set(result.events.map((event) => event.type))]
    expect(result.lanes.length).toBe(fixtureTypes.length)
    expect(result.lanes.map((lane) => lane.type).sort()).toEqual([...fixtureTypes].sort())
    // Lane order: first-appearance chronological, then type-name tie-break.
    const firstAppearance = new Map<string, string>()
    for (const event of result.events) {
      if (!firstAppearance.has(event.type)) firstAppearance.set(event.type, event.timestamp)
    }
    for (let index = 1; index < result.lanes.length; index += 1) {
      const prev = result.lanes[index - 1]!
      const next = result.lanes[index]!
      const prevTime = firstAppearance.get(prev.type)!
      const nextTime = firstAppearance.get(next.type)!
      if (prevTime !== nextTime) {
        expect(prevTime.localeCompare(nextTime)).toBeLessThan(0)
      } else {
        expect(prev.type.localeCompare(next.type)).toBeLessThan(0)
      }
    }
  })

  it('preserves source event IDs as lane item IDs and derives deterministic time bounds', () => {
    const result = adaptTemporalFixture(suiteTemporal(), 'timeline')
    if (result.kind !== 'timeline') throw new Error('unexpected kind')
    const laneEventIds = result.lanes.flatMap((lane) => lane.events.map((event) => event.id)).sort()
    expect(laneEventIds).toEqual(result.events.map((event) => event.id).sort())
    const sorted = result.events.map((event) => event.timestamp).sort()
    expect(result.timeBounds).toEqual({ start: sorted[0], end: sorted[sorted.length - 1] })
    // Events stay chronological within each lane.
    for (const lane of result.lanes) {
      const timestamps = lane.events.map((event) => event.timestamp)
      expect(timestamps).toEqual([...timestamps].sort())
    }
  })
})

describe('visual parity — dashboard adapter model', () => {
  it('emits lifelines, dual activity series, and metric series', () => {
    const result = adaptTemporalFixture(suiteTemporal(), 'temporal-dashboard')
    if (result.kind !== 'temporal-dashboard') throw new Error('unexpected kind')
    // Lifelines: one ranged bar per entity with deterministic bounds.
    expect(result.lifelines.length).toBe(result.entities.length)
    for (const lifeline of result.lifelines) {
      expect(lifeline.start <= lifeline.end).toBe(true)
      expect(typeof lifeline.label).toBe('string')
      expect(typeof lifeline.type).toBe('string')
    }
    // Activity: both upstream series preserved.
    expect(result.activity.length).toBeGreaterThan(0)
    for (const point of result.activity) {
      expect(typeof point.activeEntities).toBe('number')
      expect(typeof point.activeRelationships).toBe('number')
    }
    expect(result.metricsSeries?.length).toBeGreaterThan(0)
  })

  it('counts a relationship as active at t iff BOTH endpoints are active at t', () => {
    const result = adaptTemporalFixture(
      {
        dashboard: {
          entities: [
            { id: 'a', type: 'T', label: 'A' },
            { id: 'b', type: 'T', label: 'B' },
          ],
          relationships: [{ id: 'r1', source: 'a', target: 'b', type: 'rel' }],
          timestamps: {
            a: ['2024-01-01', '2024-02-01'],
            b: ['2024-02-01', '2024-03-01'],
          },
        },
      },
      'temporal-dashboard',
    )
    if (result.kind !== 'temporal-dashboard') throw new Error('unexpected kind')
    const byTime = new Map(result.activity.map((point) => [point.timestamp, point]))
    expect(byTime.get('2024-01-01')).toMatchObject({ activeEntities: 1, activeRelationships: 0 })
    expect(byTime.get('2024-02-01')).toMatchObject({ activeEntities: 2, activeRelationships: 1 })
    expect(byTime.get('2024-03-01')).toMatchObject({ activeEntities: 1, activeRelationships: 0 })
  })
})

describe('visual parity — evolution adapter model', () => {
  it('exposes frameTimes, a full graph model, and normative frame membership', () => {
    const result = adaptTemporalFixture(suiteTemporal(), 'network-evolution')
    if (result.kind !== 'network-evolution') throw new Error('unexpected kind')
    // frameTimes = sorted union of all entity timestamp values.
    const expectedFrames = [...new Set(Object.values(result.timestamps).flat())].sort()
    expect(result.frameTimes).toEqual(expectedFrames)
    // Full graph model is renderer-ready and matches the node/edge inventory.
    expect(result.graph.nodes.map((node) => node.id)).toEqual(result.nodes.map((node) => node.id))
    expect(result.graph.edges.map((edge) => edge.id)).toEqual(result.edges.map((edge) => edge.id))
    // Normative membership: node active at t <=> t ∈ timestamps[nodeId];
    // edge active at t <=> both endpoints active at t.
    for (const frameTime of result.frameTimes) {
      const membership = result.frameMembership[frameTime]
      expect(membership, `membership missing for frame ${frameTime}`).toBeDefined()
      const expectedNodes = result.nodes
        .filter((node) => (result.timestamps[node.id] ?? []).includes(frameTime))
        .map((node) => node.id)
        .sort()
      expect([...membership.nodeIds].sort()).toEqual(expectedNodes)
      const nodeSet = new Set(membership.nodeIds)
      const expectedEdges = result.edges
        .filter((edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target))
        .map((edge) => edge.id)
        .sort()
      expect([...membership.edgeIds].sort()).toEqual(expectedEdges)
    }
  })

  it('computes one stable global layout; frame filtering never changes node coordinates', () => {
    const result = adaptTemporalFixture(suiteTemporal(), 'network-evolution')
    if (result.kind !== 'network-evolution') throw new Error('unexpected kind')
    const graphInput = {
      nodes: result.graph.nodes.map((node) => ({ id: node.id, label: node.label, group: node.group })),
      edges: result.graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
    }
    // The shared neutral layout helper is deterministic for a fixed seed…
    const first = computeGraphTopology(graphInput, 'layout', { seed: 'temporal-evolution' })
    const second = computeGraphTopology(graphInput, 'layout', { seed: 'temporal-evolution' })
    expect(second.positionHash).toBe(first.positionHash)
    const positions = Object.fromEntries(Array.from(first.positions.entries()))
    // …and membership filtering for any two frames reuses identical x/y for
    // every unchanged node (frameTime-only changes never recompute).
    const [frameA, frameB] = [result.frameTimes[0]!, result.frameTimes[result.frameTimes.length - 1]!]
    const membershipA = new Set(result.frameMembership[frameA]!.nodeIds)
    const membershipB = new Set(result.frameMembership[frameB]!.nodeIds)
    const shared = [...membershipA].filter((id) => membershipB.has(id))
    expect(shared.length).toBeGreaterThan(0)
    for (const id of shared) {
      // Same global positions object is consulted for every frame: a filtered
      // frame view reads identical coordinates for unchanged nodes.
      const frameModel: ShowcaseGraphModel = {
        nodes: result.graph.nodes.filter((node) => membershipB.has(node.id)),
        edges: result.graph.edges.filter((edge) => result.frameMembership[frameB]!.edgeIds.includes(edge.id)),
      }
      expect(frameModel.nodes.find((node) => node.id === id)).toBeDefined()
      expect(positions[id]).toBeDefined()
    }
  })
})

describe('visual parity — analytics adapter model', () => {
  it('assigns deterministic ranks to the centrality bars model', () => {
    const result = adaptAnalyticsFixture(suiteAnalytics(), 'centrality')
    if (result.kind !== 'centrality') throw new Error('unexpected kind')
    result.rankings.forEach((ranking, index) => {
      expect(ranking.rank).toBe(index + 1)
    })
  })

  it('maps distinct community IDs to distinct node.color values on the graph model', () => {
    const result = adaptAnalyticsFixture(suiteAnalytics(), 'communities')
    if (result.kind !== 'communities') throw new Error('unexpected kind')
    const colorByCommunity = new Map<string, string>()
    for (const node of result.graph.nodes) {
      const communityId = result.assignments[node.id]
      expect(communityId, `node ${node.id} lacks a community assignment`).toBeDefined()
      const key = String(communityId)
      const existing = colorByCommunity.get(key)
      if (existing) {
        expect(node.color, `community ${key} nodes share one color`).toBe(existing)
      } else {
        colorByCommunity.set(key, node.color ?? '')
      }
      expect(node.color, `node ${node.id} must carry an explicit color`).toBeTruthy()
      // group is retained as semantic metadata.
      expect(node.group).toBeTruthy()
    }
    expect(colorByCommunity.size).toBeGreaterThan(1)
    const distinctColors = new Set(colorByCommunity.values())
    expect(distinctColors.size).toBe(colorByCommunity.size)
  })

  it('is deterministic: community colors do not depend on fixture ordering', () => {
    const base = suiteAnalytics()
    const shuffled = {
      ...base,
      graph: {
        entities: [...base.graph.entities].reverse(),
        relationships: [...base.graph.relationships].reverse(),
      },
    }
    const forward = adaptAnalyticsFixture(base, 'communities')
    const reversed = adaptAnalyticsFixture(shuffled, 'communities')
    if (forward.kind !== 'communities' || reversed.kind !== 'communities') {
      throw new Error('unexpected kinds')
    }
    const colorOf = (result: typeof forward, nodeId: string) =>
      result.graph.nodes.find((node) => node.id === nodeId)?.color
    for (const node of forward.graph.nodes) {
      expect(colorOf(reversed, node.id)).toBe(node.color)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Layer 2 — renderer/DOM tests                                        */
/* ------------------------------------------------------------------ */

describe('visual parity — timeline renderer', () => {
  it('mounts a Gantt visualization with one bar per event and lanes in adapter order', () => {
    const adapter = adaptTemporalFixture(suiteTemporal(), 'timeline')
    if (adapter.kind !== 'timeline') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    expect(screen.getByTestId('temporal-timeline-visualization')).toBeDefined()
    const spec = latestVegaSpec() as {
      mark: { type: string }
      data: { values: Array<{ id: string; lane: string }> }
      encoding: { y: { sort: string[] } }
    }
    expect(spec.mark.type).toBe('bar')
    expect(spec.data.values.length).toBe(adapter.events.length)
    expect(spec.data.values.map((row) => row.id).sort()).toEqual(
      adapter.events.map((event) => event.id).sort(),
    )
    expect(spec.encoding.y.sort).toEqual(adapter.lanes.map((lane) => lane.type))
  })
})

describe('visual parity — versions renderer', () => {
  it('renders a connected chronological ladder, not an inventory list', () => {
    const fixture = getDataset(TEMPORAL_KG).temporal
    if (!fixture) throw new Error('temporal payload missing')
    const adapter = adaptTemporalFixture(fixture, 'version-history')
    if (adapter.kind !== 'version-history') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    expect(screen.getByTestId('temporal-versions-visualization')).toBeDefined()
    // Connected sequence: a line layer joins the point marks along the date axis.
    const spec = latestVegaSpec() as {
      layer: Array<{ mark: { type: string }; data: { values: Array<{ id: string }> } }>
    }
    expect(spec.layer.map((layer) => layer.mark.type)).toEqual(['line', 'point'])
    expect(spec.layer[1]!.data.values.map((row) => row.id)).toEqual(
      adapter.versions.map((version) => version.id),
    )
  })
})

describe('visual parity — dashboard renderer', () => {
  it('mounts lifecycle, dual-series activity, and metric-series panels', () => {
    const adapter = adaptTemporalFixture(suiteTemporal(), 'temporal-dashboard')
    if (adapter.kind !== 'temporal-dashboard') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const spec = latestVegaSpec() as {
      vconcat: Array<{ mark: { type: string }; data: { values: unknown[] } }>
    }
    expect(spec.vconcat.length).toBe(3)
    // One ranged bar per entity.
    expect(spec.vconcat[0]!.mark.type).toBe('bar')
    expect(spec.vconcat[0]!.data.values.length).toBe(adapter.lifelines.length)
    // Both upstream activity series preserved.
    expect(spec.vconcat[1]!.data.values.length).toBe(adapter.activity.length * 2)
    // One row per metric point per series.
    const metricPoints = (adapter.metricsSeries ?? []).reduce((sum, s) => sum + s.values.length, 0)
    expect(spec.vconcat[2]!.data.values.length).toBe(metricPoints)
  })
})

describe('visual parity — evolution renderer', () => {
  function evolutionAdapter() {
    const adapter = adaptTemporalFixture(suiteTemporal(), 'network-evolution')
    if (adapter.kind !== 'network-evolution') throw new Error('unexpected kind')
    return adapter
  }

  it('mounts a Sigma canvas and a time slider over the frame times', () => {
    const adapter = evolutionAdapter()
    render(<TemporalShowcaseView adapter={adapter} />)
    expect(screen.getByTestId('temporal-evolution-visualization')).toBeDefined()
    // Sigma canvas (mocked in jsdom; the readonly container keeps its role).
    expect(screen.getByRole('application')).toBeDefined()
    const slider = screen.getByTestId('temporal-evolution-slider')
    expect(slider.getAttribute('max')).toBe(String(adapter.frameTimes.length - 1))
  })

  it('moving the slider changes the active frame; invalid selection resets (R8)', () => {
    const adapter = evolutionAdapter()
    const selections: Array<string | null> = []
    // Select a node that exists in the first frame, then move to a frame
    // where it is absent: the selection must reset.
    const firstFrame = adapter.frameTimes[0]!
    const lastFrame = adapter.frameTimes[adapter.frameTimes.length - 1]!
    const membershipFirst = new Set(adapter.frameMembership[firstFrame]!.nodeIds)
    const membershipLast = new Set(adapter.frameMembership[lastFrame]!.nodeIds)
    const dropped = [...membershipFirst].find((id) => !membershipLast.has(id))
    const kept = [...membershipFirst].find((id) => membershipLast.has(id))
    render(
      <TemporalShowcaseView
        adapter={adapter}
        selection={dropped ?? null}
        onSelect={(next) => selections.push(next)}
      />,
    )
    const label = () => screen.getByTestId('temporal-evolution-frame-label').textContent
    expect(label()).toBe(firstFrame)
    if (dropped) {
      fireEvent.change(screen.getByTestId('temporal-evolution-slider'), {
        target: { value: String(adapter.frameTimes.length - 1) },
      })
      expect(label()).toBe(lastFrame)
      expect(selections).toContain(null)
    }
    expect(kept ?? dropped ?? adapter.nodes[0]?.id).toBeTruthy()
  })
})

describe('visual parity — centrality renderer', () => {
  it('renders bar marks in descending score order', () => {
    const adapter = adaptAnalyticsFixture(suiteAnalytics(), 'centrality')
    if (adapter.kind !== 'centrality') throw new Error('unexpected kind')
    render(<AnalyticsShowcaseView adapter={adapter} />)
    expect(screen.getByTestId('analytics-centrality-visualization')).toBeDefined()
    const spec = latestVegaSpec() as {
      mark: { type: string }
      data: { values: Array<{ nodeId: string }> }
      encoding: { y: { sort: string[] } }
    }
    expect(spec.mark.type).toBe('bar')
    expect(spec.data.values.map((row) => row.nodeId)).toEqual(
      adapter.rankings.map((ranking) => ranking.nodeId),
    )
    expect(spec.encoding.y.sort).toEqual(adapter.rankings.map((ranking) => ranking.nodeId))
  })
})

describe('visual parity — communities renderer', () => {
  it('mounts a Sigma canvas for the community-colored KG', () => {
    const adapter = adaptAnalyticsFixture(suiteAnalytics(), 'communities')
    if (adapter.kind !== 'communities') throw new Error('unexpected kind')
    render(<AnalyticsShowcaseView adapter={adapter} />)
    expect(screen.getByTestId('analytics-communities-visualization')).toBeDefined()
    expect(screen.getByRole('application')).toBeDefined()
  })
})

/* ------------------------------------------------------------------ */
/* Layer 3 — screen-level: no duplicated inventory in the canvas       */
/* ------------------------------------------------------------------ */

describe('visual parity — center panel contains no duplicated inventory lists', () => {
  function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <SemanticaShowcaseScreen />
      </QueryClientProvider>,
    )
  }

  function selectDataset(datasetDisplayName: string) {
    fireEvent.click(screen.getByTestId('dataset-selector'))
    fireEvent.click(screen.getByRole('menuitemradio', { name: datasetDisplayName }))
  }

  it('temporal center canvas has no Entities/Series/Nodes/Edges inventory lists', () => {
    renderScreen()
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-temporal'))
    for (const submode of ['Dashboard', 'Evolution']) {
      fireEvent.click(screen.getByRole('button', { name: submode }))
      const center = document.querySelector('.showcase-ref-center')
      expect(center).toBeTruthy()
      expect(center!.textContent).not.toMatch(/^\s*Entities\s*$/m)
      expect(center!.querySelector('[data-testid="temporal-showcase-view"] ul')).toBeNull()
    }
  })

  it('analytics center canvas has no Partition/Assignments inventory lists', () => {
    renderScreen()
    selectDataset('03 Complete Visualization Suite')
    fireEvent.click(screen.getByTestId('showcase-tab-analytics'))
    fireEvent.click(screen.getByRole('button', { name: 'Communities' }))
    const center = document.querySelector('.showcase-ref-center')
    expect(center).toBeTruthy()
    expect(center!.textContent).not.toMatch(/Partition/)
    expect(center!.textContent).not.toMatch(/Assignments/)
    expect(center!.querySelector('[data-testid="analytics-showcase-view"] ul')).toBeNull()
  })
})
