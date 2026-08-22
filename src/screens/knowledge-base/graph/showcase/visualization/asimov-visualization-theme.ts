/**
 * Canonical Asimov visualization theme, version `asimov-visualization-v1`
 * (plan `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, W2).
 *
 * One versioned, renderer-neutral contract (A3/A4). Surfaces and typography
 * reference the existing `--asimov-*` / font CSS tokens; categorical colors
 * reference the 12 canonical swatch tokens from
 * `asimov-visualization-swatches.css` (via `sigma-control-state.ts` token
 * names and the generated value mirror in
 * `asimov-visualization-swatch-values.ts`). No hex literals live here or in
 * renderer files.
 *
 * Color separation (A4/A5): `categorical` swatches are the ONLY source of
 * series/community/type colors; `semantic` status colors stay semantic and
 * are never consumed as categorical series colors.
 */

import { ASIMOV_VISUALIZATION_SWATCH_TOKENS } from '../sigma-control-state'
import {
  ASIMOV_CATEGORICAL_SERIES_ORDER,
  ASIMOV_CATEGORICAL_SWATCH_ORDER,
  ASIMOV_VISUALIZATION_SWATCH_VALUES,
} from './asimov-visualization-swatch-values'
import {
  ASIMOV_VISUALIZATION_SPATIAL
  
} from './asimov-visualization-spatial'
import type {AsimovVisualizationSpatialTokens} from './asimov-visualization-spatial';

export const ASIMOV_VISUALIZATION_THEME_VERSION = 'asimov-visualization-v1' as const

export interface AsimovVisualizationTheme {
  version: typeof ASIMOV_VISUALIZATION_THEME_VERSION
  typography: {
    /** Human-readable labels/titles: Manrope UI chain (DESIGN.md). */
    labelFont: string
    /** Machine values, timestamps, axis numerics: JetBrains Mono chain. */
    valueFont: string
    titleFont: string
  }
  surfaces: {
    background: 'transparent'
    border: string
    borderStrong: string
    text: string
    textMuted: string
    textQuiet: string
  }
  /** All 12 canonical swatches as `var(--…)` references, canonical order. */
  categorical: readonly string[]
  /** Resolved hex mirror of `categorical` for DOM-free layers. */
  categoricalValues: readonly string[]
  /** Categorical series range (surface-adjacent swatches excluded). */
  series: readonly string[]
  seriesValues: readonly string[]
  /** Semantic status colors — never used as categorical series colors. */
  semantic: {
    success: string
    warning: string
    danger: string
    info: string
    focus: string
  }
  geometry: AsimovVisualizationSpatialTokens
  marks: {
    strokeWidth: number
    guideOpacity: number
    pointSize: number
  }
}

export const ASIMOV_VISUALIZATION_THEME: AsimovVisualizationTheme = {
  version: ASIMOV_VISUALIZATION_THEME_VERSION,
  typography: {
    labelFont: "var(--font-ui), Manrope, 'Noto Sans SC', sans-serif",
    valueFont: "var(--font-mono-studio), 'JetBrains Mono', monospace",
    titleFont: "var(--font-ui), Manrope, 'Noto Sans SC', sans-serif",
  },
  surfaces: {
    background: 'transparent',
    border: 'var(--asimov-border)',
    borderStrong: '1px solid var(--asimov-outline)',
    text: 'var(--asimov-text)',
    textMuted: 'var(--asimov-muted)',
    textQuiet: 'var(--asimov-quiet)',
  },
  categorical: ASIMOV_CATEGORICAL_SWATCH_ORDER.map(
    (swatch) => `var(${ASIMOV_VISUALIZATION_SWATCH_TOKENS[swatch]})`,
  ),
  categoricalValues: ASIMOV_CATEGORICAL_SWATCH_ORDER.map(
    (swatch) => ASIMOV_VISUALIZATION_SWATCH_VALUES[swatch],
  ),
  series: ASIMOV_CATEGORICAL_SERIES_ORDER.map(
    (swatch) => `var(${ASIMOV_VISUALIZATION_SWATCH_TOKENS[swatch]})`,
  ),
  seriesValues: ASIMOV_CATEGORICAL_SERIES_ORDER.map(
    (swatch) => ASIMOV_VISUALIZATION_SWATCH_VALUES[swatch],
  ),
  semantic: {
    success: 'var(--theme-success, var(--asimov-brand))',
    warning: 'var(--theme-warning, var(--asimov-control-yellow))',
    danger: 'var(--theme-danger)',
    info: 'var(--theme-info, var(--asimov-visualization-swatch-cobalt))',
    focus: 'var(--asimov-brand)',
  },
  geometry: ASIMOV_VISUALIZATION_SPATIAL,
  marks: {
    strokeWidth: 1.5,
    guideOpacity: 0.35,
    pointSize: 5,
  },
}

/**
 * Deterministic categorical mapping policy (§6.2):
 *
 *   category identity → stable category ordering (locale-sort of the
 *   identities present in the active model) → series-range index → color.
 *
 * Because the index derives from the SORTED identity list — never from
 * fixture row order, insertion order, or hash — a dataset or submode switch
 * that keeps the same category identities never recolors them, and two
 * categories never share a color unless the range wraps (identities > range).
 *
 * Returns a `var(--…)` token reference by default; pass `values: true` for
 * the resolved hex mirror (DOM-free adapter layers).
 */
export function asimovCategoricalColor(
  categoryId: string,
  orderedCategoryIds: readonly string[],
  options?: { values?: boolean },
): string {
  const range = options?.values
    ? ASIMOV_VISUALIZATION_THEME.seriesValues
    : ASIMOV_VISUALIZATION_THEME.series
  const ordered = [...orderedCategoryIds].sort((left, right) => left.localeCompare(right))
  const index = ordered.indexOf(categoryId)
  const safeIndex = index >= 0 ? index : 0
  return range[safeIndex % range.length]
}
