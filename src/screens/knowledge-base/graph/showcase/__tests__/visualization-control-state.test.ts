/**
 * W3/W6: renderer-neutral VisualizationControlState validation tests and
 * W6-03 deterministic compilation tests for the Vega-Lite compiler (plan
 * `2026-08-22-semantica-vega-lite-chart-engine-v1`).
 */

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VISUALIZATION_CONTROL_STATE,
  applyVisualizationControlPatch,
  validateVisualizationControlPatch,
} from '../visualization/visualization-control-state'
import {
  asimovVegaConfig,
  buildCentralitySpec,
} from '../visualization/vega-lite/asimov-vega-compiler'
import { ASIMOV_VISUALIZATION_THEME } from '../visualization/asimov-visualization-theme'

describe('visualization control state validation', () => {
  it('accepts the default state as a valid (empty) patch target', () => {
    const result = validateVisualizationControlPatch({})
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.state).toEqual(DEFAULT_VISUALIZATION_CONTROL_STATE)
  })

  it('applies schema-valid patches', () => {
    const { state, errors } = applyVisualizationControlPatch(DEFAULT_VISUALIZATION_CONTROL_STATE, {
      border: false,
      axes: { guides: false },
      mark: { size: 8, opacity: 60 },
      interaction: { hover: false },
    })
    expect(errors).toEqual([])
    expect(state.border).toBe(false)
    expect(state.axes.guides).toBe(false)
    expect(state.axes.x).toBe(true)
    expect(state.mark.size).toBe(8)
    expect(state.interaction.hover).toBe(false)
  })

  it('fails closed on unsupported top-level mutations', () => {
    const { state, errors } = applyVisualizationControlPatch(DEFAULT_VISUALIZATION_CONTROL_STATE, {
      vegaSpec: { mark: 'bar' },
      border: false,
    })
    expect(errors.length).toBeGreaterThan(0)
    // Atomic: the valid `border` change is NOT partially applied.
    expect(state).toBe(DEFAULT_VISUALIZATION_CONTROL_STATE)
  })

  it('rejects invalid enum values', () => {
    for (const patch of [
      { renderer: 'recharts-svg' },
      { renderer: 'canvas' },
      { palette: 'tableau-10' },
      { background: 'white' },
      { mark: { type: 'area' } },
    ]) {
      const result = validateVisualizationControlPatch(patch)
      expect(result.ok, JSON.stringify(patch)).toBe(false)
    }
  })

  it('rejects a grid unit that is not a positive multiple of the 8px base unit', () => {
    expect(validateVisualizationControlPatch({ gridUnitPx: 20 }).ok).toBe(false)
    expect(validateVisualizationControlPatch({ gridUnitPx: 0 }).ok).toBe(false)
    expect(validateVisualizationControlPatch({ gridUnitPx: 24 }).ok).toBe(true)
    expect(validateVisualizationControlPatch({ gridUnitPx: 32 }).ok).toBe(true)
  })

  it('rejects unsupported nested keys fail-closed', () => {
    const { state, errors } = applyVisualizationControlPatch(DEFAULT_VISUALIZATION_CONTROL_STATE, {
      axes: { x: false, projection: '3d' },
    })
    expect(errors).toEqual(['axes.projection: unsupported control mutation'])
    expect(state.axes.x).toBe(true)
  })

  it('clamps mark numbers into supported ranges', () => {
    const result = validateVisualizationControlPatch({ mark: { size: 999, opacity: -5 } })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.mark.size).toBe(24)
      expect(result.state.mark.opacity).toBe(0)
    }
  })

  it('accepts the Vega-Lite engine renderer enum only', () => {
    for (const renderer of ['vega-svg', 'sigma'] as const) {
      expect(validateVisualizationControlPatch({ renderer }).ok).toBe(true)
    }
  })
})

describe('deterministic Vega-Lite compilation (W6-03 / A12)', () => {
  it('compiles the same control state to a deeply-equal config', () => {
    const first = asimovVegaConfig({ controls: DEFAULT_VISUALIZATION_CONTROL_STATE })
    const second = asimovVegaConfig({ controls: DEFAULT_VISUALIZATION_CONTROL_STATE })
    expect(second).toEqual(first)
  })

  it('compiles control changes into the spec config deterministically', () => {
    const base = asimovVegaConfig({ controls: DEFAULT_VISUALIZATION_CONTROL_STATE }) as {
      background: string
      axis: { grid: boolean }
    }
    expect(base.background).toBe('transparent')
    expect(base.axis.grid).toBe(true)

    const { state } = applyVisualizationControlPatch(DEFAULT_VISUALIZATION_CONTROL_STATE, {
      axes: { guides: false },
      mark: { size: 9 },
    })
    const compiled = asimovVegaConfig({ controls: state }) as { axis: { grid: boolean } }
    expect(compiled.axis.grid).toBe(false)
    expect(asimovVegaConfig({ controls: state })).toEqual(compiled)
  })

  it('sources categorical colors only from the canonical series swatch values', () => {
    const config = asimovVegaConfig({ controls: DEFAULT_VISUALIZATION_CONTROL_STATE }) as {
      range: { category: string[] }
    }
    expect(config.range.category).toEqual([...ASIMOV_VISUALIZATION_THEME.seriesValues])
  })

  it('narrows the centrality x-domain deterministically under zoom', () => {
    const rankings = [
      { nodeId: 'a', score: 4, rank: 1 },
      { nodeId: 'b', score: 2, rank: 2 },
    ]
    const full = buildCentralitySpec(rankings, { controls: DEFAULT_VISUALIZATION_CONTROL_STATE }) as {
      encoding: { x: { scale: { domain: number[] } } }
    }
    expect(full.encoding.x.scale.domain).toEqual([0, 4])
    const { state } = applyVisualizationControlPatch(DEFAULT_VISUALIZATION_CONTROL_STATE, {
      interaction: { zoomFactor: 2 },
    })
    const zoomed = buildCentralitySpec(rankings, { controls: state }) as {
      encoding: { x: { scale: { domain: number[] } } }
    }
    expect(zoomed.encoding.x.scale.domain).toEqual([0, 2])
  })
})
