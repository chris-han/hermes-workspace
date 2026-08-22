/**
 * W3/W6: renderer-neutral VisualizationControlState validation tests and
 * W6-03 deterministic compilation tests for the Recharts/SVG compiler.
 */

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_VISUALIZATION_CONTROL_STATE,
  applyVisualizationControlPatch,
  validateVisualizationControlPatch,
} from '../visualization/visualization-control-state'
import { compileAsimovChartConfig } from '../visualization/recharts-svg/asimov-chart-compiler'

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
      { renderer: 'vega-svg' },
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

  it('accepts the fallback-path renderer enum only', () => {
    for (const renderer of ['recharts-svg', 'svg', 'sigma'] as const) {
      expect(validateVisualizationControlPatch({ renderer }).ok).toBe(true)
    }
  })
})

describe('deterministic chart compilation (W6-03 / A12)', () => {
  it('compiles the same control state to a deeply-equal config', () => {
    const first = compileAsimovChartConfig(DEFAULT_VISUALIZATION_CONTROL_STATE)
    const second = compileAsimovChartConfig(DEFAULT_VISUALIZATION_CONTROL_STATE)
    expect(second).toEqual(first)
  })

  it('compiles control changes into renderer state deterministically', () => {
    const base = compileAsimovChartConfig(DEFAULT_VISUALIZATION_CONTROL_STATE)
    expect(base.background).toBe('transparent')
    expect(base.border).toContain('var(--asimov-border)')
    expect(base.axis.visibleX).toBe(true)

    const { state } = applyVisualizationControlPatch(DEFAULT_VISUALIZATION_CONTROL_STATE, {
      border: false,
      axes: { x: false },
      mark: { size: 9 },
    })
    const compiled = compileAsimovChartConfig(state)
    expect(compiled.border).toBe('none')
    expect(compiled.axis.visibleX).toBe(false)
    expect(compiled.mark.size).toBe(9)
    expect(compileAsimovChartConfig(state)).toEqual(compiled)
  })

  it('sources categorical colors only from the canonical series range', () => {
    const config = compileAsimovChartConfig(DEFAULT_VISUALIZATION_CONTROL_STATE)
    expect(config.colors.categorical.length).toBe(10)
    for (const color of config.colors.categorical) {
      expect(color.startsWith('var(--asimov-visualization-swatch-')).toBe(true)
    }
  })
})
