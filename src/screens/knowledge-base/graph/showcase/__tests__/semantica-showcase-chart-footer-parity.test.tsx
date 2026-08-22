// @vitest-environment jsdom

/**
 * Chart footer control parity (post-implementation addendum to plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`):
 * Timeline, Versions, Dashboard, and Centrality chart footers speak the same
 * control language as the Sigma canvas footer — MODE (View/Select), ZOOM
 * (- / factor / +), FIT, and the gear — with every mutation routed through
 * the fail-closed `VisualizationControlState` patch path. Zoom/pan state
 * resets deterministically on dataset/submode remount (keyed views).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { adaptTemporalFixture } from '../adapters/temporal-showcase-adapter'
import { adaptAnalyticsFixture } from '../adapters/analytics-showcase-adapter'
import { TemporalShowcaseView } from '../renderers/temporal-showcase-view'
import { AnalyticsShowcaseView } from '../renderers/analytics-showcase-view'
import { getDataset } from '../semantica-showcase-dataset'
import {
  DEFAULT_VISUALIZATION_CONTROL_STATE,
  applyVisualizationControlPatch,
} from '../visualization/visualization-control-state'
import { collectVegaParams, latestVegaRender, latestVegaSpec, resetCapturedVega } from './vega-capture'

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

// Vega-Lite engine: assert the deterministic compiled spec captured by the
// react-vega double instead of renderer DOM marks (A12).
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

function temporalAdapterFor(submode: 'timeline' | 'temporal-dashboard') {
  const fixture = getDataset(SUITE).temporal
  if (!fixture) throw new Error('temporal payload missing')
  return adaptTemporalFixture(fixture, submode)
}

function versionsAdapter() {
  const fixture = getDataset('10-Temporal-Knowledge-Graphs').temporal
  if (!fixture) throw new Error('temporal payload missing')
  return adaptTemporalFixture(fixture, 'version-history')
}

function centralityAdapter() {
  const fixture = getDataset(SUITE).analytics
  if (!fixture) throw new Error('analytics payload missing')
  return adaptAnalyticsFixture(fixture, 'centrality')
}

function expectFooterParityControls() {
  expect(screen.getByTestId('chart-mode-view')).toBeDefined()
  expect(screen.getByTestId('chart-mode-select')).toBeDefined()
  expect(screen.getByTestId('chart-zoom-out')).toBeDefined()
  expect(screen.getByTestId('chart-zoom-value').textContent).toBe('1.0x')
  expect(screen.getByTestId('chart-zoom-in')).toBeDefined()
  expect(screen.getByTestId('chart-fit')).toBeDefined()
  expect(screen.getByTestId('visualization-controls-toggle')).toBeDefined()
  // Graph-only controls are absent, not disabled clutter.
  expect(screen.queryByText('LAYOUT')).toBeNull()
  expect(screen.queryByText('NUDGE')).toBeNull()
  expect(screen.queryByText('EDGES')).toBeNull()
  expect(screen.queryByText('Path')).toBeNull()
}

describe('chart footer control parity — presence on every chart view', () => {
  it('renders MODE / ZOOM / FIT / gear on the Timeline footer', () => {
    render(<TemporalShowcaseView adapter={temporalAdapterFor('timeline')} />)
    expectFooterParityControls()
  })

  it('renders MODE / ZOOM / FIT / gear on the Versions footer', () => {
    render(<TemporalShowcaseView adapter={versionsAdapter()} />)
    expectFooterParityControls()
  })

  it('renders MODE / ZOOM / FIT / gear on the Dashboard footer', () => {
    render(<TemporalShowcaseView adapter={temporalAdapterFor('temporal-dashboard')} />)
    expectFooterParityControls()
  })

  it('renders MODE / ZOOM / FIT / gear on the Centrality footer', () => {
    render(<AnalyticsShowcaseView adapter={centralityAdapter()} />)
    expectFooterParityControls()
  })
})

describe('chart footer control parity — zoom behavior', () => {
  it('zoom-in narrows the timeline Gantt initial x-domain; FIT restores', () => {
    const adapter = temporalAdapterFor('timeline')
    if (adapter.kind !== 'timeline') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const xScale = () =>
      (latestVegaSpec() as { encoding: { x: { scale?: { domain?: string[] } } } }).encoding.x.scale
    expect(xScale()?.domain).toBeUndefined()

    fireEvent.click(screen.getByTestId('chart-zoom-in'))
    expect(screen.getByTestId('chart-zoom-value').textContent).toBe('1.3x')
    const domain = xScale()?.domain
    expect(domain).toBeDefined()
    const [min, max] = domain!.map((value) => Date.parse(value))
    const fullSpan = Date.parse(adapter.timeBounds.end) - Date.parse(adapter.timeBounds.start)
    expect(max - min).toBeLessThan(fullSpan)

    fireEvent.click(screen.getByTestId('chart-fit'))
    expect(screen.getByTestId('chart-zoom-value').textContent).toBe('1.0x')
    expect(xScale()?.domain).toBeUndefined()
  })

  it('zoom-in narrows the versions ladder x-domain', () => {
    const adapter = versionsAdapter()
    if (adapter.kind !== 'version-history') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const domainOf = () =>
      (latestVegaSpec() as { layer: Array<{ encoding: { x: { scale?: { domain?: string[] } } } }> })
        .layer[1]!.encoding.x.scale?.domain
    expect(domainOf()).toBeUndefined()
    fireEvent.click(screen.getByTestId('chart-zoom-in'))
    expect(domainOf()).toBeDefined()
  })

  it('zoom-in narrows the dashboard shared x-domain; FIT restores it', () => {
    const adapter = temporalAdapterFor('temporal-dashboard')
    if (adapter.kind !== 'temporal-dashboard') throw new Error('unexpected kind')
    render(<TemporalShowcaseView adapter={adapter} />)
    const domainOf = () =>
      (latestVegaSpec() as { vconcat: Array<{ encoding: { x: { scale?: { domain?: string[] } } } }> })
        .vconcat[0]!.encoding.x.scale?.domain
    expect(domainOf()).toBeUndefined()
    fireEvent.click(screen.getByTestId('chart-zoom-in'))
    expect(screen.getByTestId('chart-zoom-value').textContent).toBe('1.3x')
    expect(domainOf()).toBeDefined()
    fireEvent.click(screen.getByTestId('chart-fit'))
    expect(domainOf()).toBeUndefined()
  })

  it('zoom-in narrows the centrality score domain; FIT restores it', () => {
    const adapter = centralityAdapter()
    if (adapter.kind !== 'centrality') throw new Error('unexpected kind')
    render(<AnalyticsShowcaseView adapter={adapter} />)
    const maxScore = adapter.rankings[0]!.score
    const domainOf = () =>
      (latestVegaSpec() as { encoding: { x: { scale: { domain: number[] } } } }).encoding.x.scale.domain
    expect(domainOf()).toEqual([0, maxScore])
    fireEvent.click(screen.getByTestId('chart-zoom-in'))
    const narrowed = domainOf()
    expect(narrowed[0]).toBe(0)
    expect(narrowed[1]).toBeLessThan(maxScore)
    fireEvent.click(screen.getByTestId('chart-fit'))
    expect(domainOf()).toEqual([0, maxScore])
  })

  it('zoom-out is disabled at the full extent and zoom clamps at the maximum', () => {
    render(<TemporalShowcaseView adapter={temporalAdapterFor('timeline')} />)
    expect(screen.getByTestId('chart-zoom-out').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('chart-fit').hasAttribute('disabled')).toBe(true)
    const zoomIn = screen.getByTestId('chart-zoom-in')
    for (let index = 0; index < 8; index += 1) fireEvent.click(zoomIn)
    expect(screen.getByTestId('chart-zoom-value').textContent).toBe('4.0x')
    expect(screen.getByTestId('chart-zoom-in').hasAttribute('disabled')).toBe(true)
  })
})

describe('chart footer control parity — mode behavior', () => {
  it('View (default) compiles no pick param; Select compiles it and routes clicks to onSelect', () => {
    const adapter = temporalAdapterFor('timeline')
    if (adapter.kind !== 'timeline') throw new Error('unexpected kind')
    const selections: Array<string | null> = []
    render(
      <TemporalShowcaseView
        adapter={adapter}
        selection={null}
        onSelect={(next) => selections.push(next)}
      />,
    )
    // Default mode is View (hover only): no click-select param, no listeners.
    expect(screen.getByTestId('chart-mode-view').getAttribute('aria-pressed')).toBe('true')
    expect(collectVegaParams(latestVegaSpec()).some((param) => param.name === 'pick')).toBe(false)
    expect(latestVegaRender().signalListeners).toBeUndefined()

    fireEvent.click(screen.getByTestId('chart-mode-select'))
    expect(screen.getByTestId('chart-mode-select').getAttribute('aria-pressed')).toBe('true')
    expect(collectVegaParams(latestVegaSpec()).some((param) => param.name === 'pick')).toBe(true)
    const listeners = latestVegaRender().signalListeners
    expect(listeners?.pick).toBeDefined()
    // Simulate the Vega runtime reporting a point selection on the first event.
    listeners!.pick!('pick', { id: [adapter.events[0]!.id] })
    expect(selections).toEqual([adapter.events[0]!.id])
  })

  it('gates centrality bar click selection on the Select mode', () => {
    const adapter = centralityAdapter()
    if (adapter.kind !== 'centrality') throw new Error('unexpected kind')
    const selections: Array<string | null> = []
    render(
      <AnalyticsShowcaseView
        adapter={adapter}
        selection={null}
        onSelect={(next) => selections.push(next)}
      />,
    )
    expect(collectVegaParams(latestVegaSpec()).some((param) => param.name === 'pick')).toBe(false)
    fireEvent.click(screen.getByTestId('chart-mode-select'))
    expect(collectVegaParams(latestVegaSpec()).some((param) => param.name === 'pick')).toBe(true)
    const listeners = latestVegaRender().signalListeners
    listeners!.pick!('pick', { id: [adapter.rankings[0]!.nodeId] })
    expect(selections).toEqual([adapter.rankings[0]!.nodeId])
  })
})

describe('chart footer control parity — deterministic reset on remount', () => {
  it('zoom/mode reset when the view remounts (dataset/submode key switch)', () => {
    const adapter = temporalAdapterFor('timeline')
    const { rerender } = render(<TemporalShowcaseView key="ds-a-timeline" adapter={adapter} />)
    fireEvent.click(screen.getByTestId('chart-zoom-in'))
    fireEvent.click(screen.getByTestId('chart-mode-select'))
    expect(screen.getByTestId('chart-zoom-value').textContent).toBe('1.3x')

    rerender(<TemporalShowcaseView key="ds-b-timeline" adapter={adapter} />)
    expect(screen.getByTestId('chart-zoom-value').textContent).toBe('1.0x')
    expect(screen.getByTestId('chart-mode-view').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('control-state schema — zoom factor and mode patches', () => {
  it('defaults to View mode at the full extent', () => {
    expect(DEFAULT_VISUALIZATION_CONTROL_STATE.interaction.mode).toBe('view')
    expect(DEFAULT_VISUALIZATION_CONTROL_STATE.interaction.select).toBe(false)
    expect(DEFAULT_VISUALIZATION_CONTROL_STATE.interaction.zoomFactor).toBe(1)
  })

  it('applies and clamps zoomFactor patches deterministically', () => {
    const { state, errors } = applyVisualizationControlPatch(DEFAULT_VISUALIZATION_CONTROL_STATE, {
      interaction: { zoomFactor: 99, mode: 'select' },
    })
    expect(errors).toEqual([])
    expect(state.interaction.zoomFactor).toBe(4)
    expect(state.interaction.mode).toBe('select')
  })

  it('rejects invalid interaction values fail-closed', () => {
    for (const patch of [
      { interaction: { zoomFactor: Number.NaN } },
      { interaction: { zoomFactor: 'big' } },
      { interaction: { mode: 'path' } },
      { interaction: { lasso: true } },
    ]) {
      const { state, errors } = applyVisualizationControlPatch(DEFAULT_VISUALIZATION_CONTROL_STATE, patch)
      expect(errors.length, JSON.stringify(patch)).toBeGreaterThan(0)
      expect(state).toBe(DEFAULT_VISUALIZATION_CONTROL_STATE)
    }
  })
})
