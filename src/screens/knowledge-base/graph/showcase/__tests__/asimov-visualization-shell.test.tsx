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

const SUITE = '03-Complete-Visualization-Suite'

afterEach(() => {
  cleanup()
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
  it('snaps timeline lane baselines and svg viewport height to the 24px lattice', () => {
    const adapter = adaptTemporalFixture(temporalFixture(), 'timeline')
    if (adapter.kind !== 'timeline') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const svg = screen.getByTestId('temporal-timeline-svg')
    const height = Number(svg.getAttribute('height'))
    expect(height % ASIMOV_GRID_UNIT_PX).toBe(0)
    for (const lane of adapter.lanes) {
      const group = screen.getByTestId(`temporal-timeline-lane-${lane.type}`)
      const circles = group.querySelectorAll('circle')
      expect(circles.length).toBeGreaterThan(0)
      for (const circle of Array.from(circles)) {
        const cy = Number(circle.getAttribute('cy'))
        expect(cy % ASIMOV_GRID_UNIT_PX, `lane ${lane.type} baseline must snap`).toBe(0)
      }
    }
  })

  it('snaps versions rung Y and ladder viewport to the lattice', () => {
    const fixture = getDataset('10-Temporal-Knowledge-Graphs').temporal
    if (!fixture) throw new Error('temporal payload missing')
    const adapter = adaptTemporalFixture(fixture, 'version-history')
    if (adapter.kind !== 'version-history') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const svg = screen.getByTestId('temporal-versions-ladder')
    expect(Number(svg.getAttribute('width')) % ASIMOV_GRID_UNIT_PX).toBe(0)
    expect(Number(svg.getAttribute('height')) % ASIMOV_GRID_UNIT_PX).toBe(0)
    const rung = screen.getAllByTestId(/^temporal-version-rung-/)[0]
    const circle = rung.querySelector('circle')!
    expect(Number(circle.getAttribute('cy')) % ASIMOV_GRID_UNIT_PX).toBe(0)
  })
})

describe('data geometry is never snapped (A1 / W7-05)', () => {
  it('keeps timeline event X positions continuous (not quantized to the lattice)', () => {
    const adapter = adaptTemporalFixture(temporalFixture(), 'timeline')
    if (adapter.kind !== 'timeline') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const cxValues = adapter.events.map(
      (event) => Number(screen.getByTestId(`temporal-timeline-item-${event.id}`).getAttribute('cx')),
    )
    // Continuous time-scale positions: at least one mark must sit OFF the
    // lattice, proving data coordinates were not quantized.
    expect(cxValues.some((cx) => cx % ASIMOV_GRID_UNIT_PX !== 0)).toBe(true)
    // And identical timestamps map to identical X (deterministic scale).
    const first = adapter.events[0]
    const sameTime = adapter.events.filter((event) => event.timestamp === first.timestamp)
    if (sameTime.length > 1) {
      const xs = sameTime.map(
        (event) => screen.getByTestId(`temporal-timeline-item-${event.id}`).getAttribute('cx'),
      )
      expect(new Set(xs).size).toBe(1)
    }
  })

  it('keeps centrality bar widths proportional to scores, not lattice steps', () => {
    const adapter = adaptAnalyticsFixture(analyticsFixture(), 'centrality')
    if (adapter.kind !== 'centrality') throw new Error('unexpected kind')
    render(<AnalyticsShowcaseView adapter={adapter} />)
    const widths = adapter.rankings.map((ranking) =>
      Number(screen.getByTestId(`analytics-centrality-bar-${ranking.nodeId}`).getAttribute('width')),
    )
    expect(widths.some((width) => width % ASIMOV_GRID_UNIT_PX !== 0)).toBe(true)
    const sorted = [...widths].sort((a, b) => b - a)
    expect(widths).toEqual(sorted)
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
    // Schema-validated patch: disabling guides removes the lane guide lines.
    const lanesBefore = screen.getByTestId(`temporal-timeline-lane-${adapter.lanes[0].type}`)
    expect(lanesBefore.querySelectorAll('line').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('visualization-control-guides'))
    const lanesAfter = screen.getByTestId(`temporal-timeline-lane-${adapter.lanes[0].type}`)
    expect(lanesAfter.querySelectorAll('line').length).toBe(0)
  })
})
