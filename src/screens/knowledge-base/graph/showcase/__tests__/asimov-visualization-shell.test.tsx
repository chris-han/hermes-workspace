// @vitest-environment jsdom

/**
 * W3/W5/W7-03/W7-04/W7-05: shared visualization shell/footer DOM tests.
 *
 * Asserts the six Temporal/Analytics submodes mount through the shared
 * Asimov visualization shell (transparent viewport, structural border class,
 * per-canvas footer), that presentation geometry (lane baselines, viewport
 * heights) snaps to the 24px lattice, and that DATA geometry (event X
 * positions, bar widths) is never quantized by grid snapping (A1).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { adaptTemporalFixture } from '../adapters/temporal-showcase-adapter'
import { adaptAnalyticsFixture } from '../adapters/analytics-showcase-adapter'
import { TemporalShowcaseView } from '../renderers/temporal-showcase-view'
import { AnalyticsShowcaseView } from '../renderers/analytics-showcase-view'
import { getDataset } from '../semantica-showcase-dataset'
import { ASIMOV_GRID_UNIT_PX } from '../visualization/asimov-visualization-spatial'
import { latestVegaSpec, resetCapturedVega } from './vega-capture'

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
// geometry/data-fidelity assertions read the deterministic compiled spec
// captured by this double instead of hand-SVG DOM marks (A12).
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

const SUITE = '03-Complete-Visualization-Suite'

afterEach(() => {
  cleanup()
  resetCapturedVega()
})

function temporalFixture() {
  const fixture = getDataset(SUITE).temporal
  if (!fixture) throw new Error('temporal payload missing')
  return fixture
}

function analyticsFixture() {
  const fixture = getDataset(SUITE).analytics
  if (!fixture) throw new Error('analytics payload missing')
  return fixture
}

describe('shared visualization shell mounting (W5)', () => {
  it('mounts all four temporal submodes and both analytics submodes through the shell with a per-canvas footer', () => {
    for (const submode of ['timeline', 'temporal-dashboard', 'network-evolution'] as const) {
      cleanup()
      const adapter = adaptTemporalFixture(temporalFixture(), submode)
      const { container } = render(<TemporalShowcaseView adapter={adapter} />)
      expect(container.querySelector('.showcase-viz-shell'), submode).not.toBeNull()
      expect(container.querySelector('.showcase-viz-viewport'), submode).not.toBeNull()
      expect(screen.getByTestId('visualization-footer'), submode).toBeDefined()
    }
    cleanup()
    const versionsFixture = getDataset('10-Temporal-Knowledge-Graphs').temporal
    if (!versionsFixture) throw new Error('temporal payload missing')
    const { container } = render(
      <TemporalShowcaseView adapter={adaptTemporalFixture(versionsFixture, 'version-history')} />,
    )
    expect(container.querySelector('.showcase-viz-shell')).not.toBeNull()
    expect(screen.getByTestId('visualization-footer')).toBeDefined()

    for (const submode of ['centrality', 'communities'] as const) {
      cleanup()
      const adapter = adaptAnalyticsFixture(analyticsFixture(), submode)
      const { container: analyticsContainer } = render(<AnalyticsShowcaseView adapter={adapter} />)
      expect(analyticsContainer.querySelector('.showcase-viz-shell'), submode).not.toBeNull()
      expect(screen.getByTestId('visualization-footer'), submode).toBeDefined()
    }
  })

  it('shell/viewport carry the transparent-background contract classes, not the opaque panel class', () => {
    const adapter = adaptTemporalFixture(temporalFixture(), 'timeline')
    const { container } = render(<TemporalShowcaseView adapter={adapter} />)
    const shell = container.querySelector('.showcase-viz-shell')
    expect(shell).not.toBeNull()
    expect(shell!.classList.contains('showcase-ref-panel')).toBe(false)
  })
})

describe('lattice-aligned presentation geometry (W7-04)', () => {
  it('snaps the Gantt chart height to whole lane steps on the 24px lattice', () => {
    const adapter = adaptTemporalFixture(temporalFixture(), 'timeline')
    if (adapter.kind !== 'timeline') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const spec = latestVegaSpec() as { height: number }
    expect(spec.height % ASIMOV_GRID_UNIT_PX).toBe(0)
  })

  it('snaps the versions ladder viewport height to the lattice', () => {
    const fixture = getDataset('10-Temporal-Knowledge-Graphs').temporal
    if (!fixture) throw new Error('temporal payload missing')
    const adapter = adaptTemporalFixture(fixture, 'version-history')
    render(<TemporalShowcaseView adapter={adapter} />)
    const spec = latestVegaSpec() as { height: number }
    expect(spec.height % ASIMOV_GRID_UNIT_PX).toBe(0)
  })
})

describe('data geometry is never snapped (A1 / W7-05)', () => {
  it('keeps raw event timestamps in the compiled Gantt data (no lattice quantization)', () => {
    const adapter = adaptTemporalFixture(temporalFixture(), 'timeline')
    if (adapter.kind !== 'timeline') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const spec = latestVegaSpec() as { data: { values: Array<{ id: string; start: string }> } }
    const startByEventId = new Map(spec.data.values.map((row) => [row.id, row.start]))
    for (const event of adapter.events) {
      // The compiled spec carries the exact event instant (ISO of the raw
      // timestamp); no grid/lattice rounding is applied anywhere.
      expect(Date.parse(startByEventId.get(event.id)!)).toBe(Date.parse(event.timestamp))
    }
  })

  it('keeps centrality bar scores proportional to data, not lattice steps', () => {
    const adapter = adaptAnalyticsFixture(analyticsFixture(), 'centrality')
    if (adapter.kind !== 'centrality') throw new Error('unexpected kind')
    render(<AnalyticsShowcaseView adapter={adapter} />)
    const spec = latestVegaSpec() as { data: { values: Array<{ nodeId: string; score: number }> } }
    const scoreByNode = new Map(spec.data.values.map((row) => [row.nodeId, row.score]))
    for (const ranking of adapter.rankings) {
      expect(scoreByNode.get(ranking.nodeId)).toBe(ranking.score)
    }
  })
})

describe('visualization controls wiring (W3/W6)', () => {
  it('chart footers mount the gear trigger and open the validated control panel', () => {
    const adapter = adaptTemporalFixture(temporalFixture(), 'timeline')
    if (adapter.kind !== 'timeline') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const toggle = screen.getByTestId('visualization-controls-toggle')
    fireEvent.click(toggle)
    expect(screen.getByRole('dialog', { name: 'Visualization Controls' })).toBeDefined()
    // Schema-validated patch: disabling guides recompiles the spec with the
    // axis grid off.
    const gridBefore = () =>
      (latestVegaSpec() as { config: { axis: { grid: boolean } } }).config.axis.grid
    expect(gridBefore()).toBe(true)
    fireEvent.click(screen.getByTestId('visualization-control-guides'))
    expect(gridBefore()).toBe(false)
  })
})
