/**
 * W2/W7-06/W7-07: canonical Asimov visualization theme tests.
 *
 * - The generated swatch value module stays in exact parity with the
 *   authoritative `asimov-visualization-swatches.css` (A4 single source).
 * - Categorical mapping is deterministic: stable category ordering → series
 *   index, so dataset/submode switches never recolor the same category.
 * - Semantic status colors are a separate channel, never series colors (A5).
 */

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ASIMOV_CATEGORICAL_SERIES_ORDER,
  ASIMOV_CATEGORICAL_SWATCH_ORDER,
  ASIMOV_VISUALIZATION_SWATCH_VALUES,
} from '../visualization/asimov-visualization-swatch-values'
import {
  ASIMOV_VISUALIZATION_THEME,
  asimovCategoricalColor,
} from '../visualization/asimov-visualization-theme'
import { ASIMOV_VISUALIZATION_SWATCH_TOKENS } from '../sigma-control-state'
import {
  ASIMOV_COMMUNITY_PALETTE,
  adaptAnalyticsFixture,
} from '../adapters/analytics-showcase-adapter'
import { getDataset } from '../semantica-showcase-dataset'

function swatchesFromCss(): Record<string, string> {
  const css = readFileSync(
    new URL('../../../../../asimov-visualization-swatches.css', import.meta.url),
    'utf8',
  )
  const entries: Record<string, string> = {}
  for (const match of css.matchAll(/--asimov-visualization-swatch-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    entries[match[1]] = match[2].toLowerCase()
  }
  return entries
}

describe('asimov swatch token surface', () => {
  it('keeps the generated value module in exact parity with the CSS swatch file', () => {
    const css = swatchesFromCss()
    expect(Object.keys(css).length).toBe(12)
    for (const [swatch, token] of Object.entries(ASIMOV_VISUALIZATION_SWATCH_TOKENS)) {
      const name = token.replace('--asimov-visualization-swatch-', '')
      expect(
        ASIMOV_VISUALIZATION_SWATCH_VALUES[swatch as keyof typeof ASIMOV_VISUALIZATION_SWATCH_VALUES],
        `${swatch} must mirror ${token}`,
      ).toBe(css[name])
    }
  })

  it('keeps canonical order equal to the CSS declaration order and excludes surface swatches from the series range', () => {
    expect(ASIMOV_CATEGORICAL_SWATCH_ORDER[0]).toBe('asimov-ember')
    expect(ASIMOV_CATEGORICAL_SWATCH_ORDER.length).toBe(12)
    expect(ASIMOV_CATEGORICAL_SERIES_ORDER).not.toContain('asimov-midnight')
    expect(ASIMOV_CATEGORICAL_SERIES_ORDER).not.toContain('asimov-ivory')
    expect(ASIMOV_CATEGORICAL_SERIES_ORDER.length).toBe(10)
  })
})

describe('AsimovVisualizationTheme v1', () => {
  it('is versioned and transparent with token-referenced surfaces', () => {
    expect(ASIMOV_VISUALIZATION_THEME.version).toBe('asimov-visualization-v1')
    expect(ASIMOV_VISUALIZATION_THEME.surfaces.background).toBe('transparent')
    expect(ASIMOV_VISUALIZATION_THEME.surfaces.border).toContain('var(--asimov-border)')
    expect(ASIMOV_VISUALIZATION_THEME.typography.labelFont).toContain('Manrope')
    expect(ASIMOV_VISUALIZATION_THEME.typography.valueFont).toContain('JetBrains Mono')
    expect(ASIMOV_VISUALIZATION_THEME.geometry.gridUnitPx).toBe(24)
  })

  it('exposes the 12 swatches as var() references in canonical order', () => {
    expect(ASIMOV_VISUALIZATION_THEME.categorical.length).toBe(12)
    expect(ASIMOV_VISUALIZATION_THEME.categorical[0]).toBe('var(--asimov-visualization-swatch-ember)')
    for (const entry of ASIMOV_VISUALIZATION_THEME.categorical) {
      expect(entry.startsWith('var(--asimov-visualization-swatch-')).toBe(true)
    }
    expect(ASIMOV_VISUALIZATION_THEME.categoricalValues).toEqual(
      ASIMOV_CATEGORICAL_SWATCH_ORDER.map((swatch) => ASIMOV_VISUALIZATION_SWATCH_VALUES[swatch]),
    )
  })

  it('keeps semantic status colors out of the categorical swatch set (A5)', () => {
    const categorical = new Set([
      ...ASIMOV_VISUALIZATION_THEME.categorical,
      ...ASIMOV_VISUALIZATION_THEME.categoricalValues,
    ])
    for (const value of Object.values(ASIMOV_VISUALIZATION_THEME.semantic)) {
      expect(categorical.has(value), `semantic ${value} must not be a categorical swatch`).toBe(false)
    }
  })
})

describe('deterministic categorical mapping (§6.2)', () => {
  it('maps a category to the same swatch regardless of input ordering', () => {
    const forward = asimovCategoricalColor('WORKS_AT', ['WORKS_AT', 'AUTHORED', 'LOCATED_IN'])
    const shuffled = asimovCategoricalColor('WORKS_AT', ['LOCATED_IN', 'AUTHORED', 'WORKS_AT'])
    expect(shuffled).toBe(forward)
  })

  it('assigns adjacent sorted categories to distinct series colors', () => {
    const categories = ['a', 'b', 'c', 'd']
    const colors = categories.map((category) => asimovCategoricalColor(category, categories))
    expect(new Set(colors).size).toBe(categories.length)
  })

  it('rebinds the community palette to the canonical series token surface', () => {
    expect([...ASIMOV_COMMUNITY_PALETTE]).toEqual([...ASIMOV_VISUALIZATION_THEME.seriesValues])
  })

  it('community node colors come only from the canonical swatch set', () => {
    const fixture = getDataset('03-Complete-Visualization-Suite').analytics
    if (!fixture) throw new Error('analytics payload missing')
    const result = adaptAnalyticsFixture(fixture, 'communities')
    if (result.kind !== 'communities') throw new Error('unexpected kind')
    const allowed = new Set(ASIMOV_VISUALIZATION_THEME.categoricalValues)
    for (const color of Object.values(result.communityColors)) {
      expect(allowed.has(color), `${color} must be a canonical swatch`).toBe(true)
    }
  })
})
