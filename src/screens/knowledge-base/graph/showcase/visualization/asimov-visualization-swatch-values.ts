/**
 * Generated token surface for the canonical Asimov visualization swatches
 * (plan `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, W2).
 *
 * `src/asimov-visualization-swatches.css` is the AUTHORITATIVE definition of
 * the 12 swatch hex values. This module is the DOM-free mirror of that file
 * so adapter/semantic-model layers (which cannot call `getComputedStyle`)
 * consume the same tokens without copying hex literals into renderer files.
 * `__tests__/asimov-visualization-theme.test.ts` asserts this module stays in
 * exact parity with the CSS file; when the CSS changes, regenerate the values
 * here in the same change.
 */

import type { AsimovVisualizationSwatch } from '../sigma-control-state'

export const ASIMOV_VISUALIZATION_SWATCH_VALUES: Record<AsimovVisualizationSwatch, string> = {
  'asimov-ember': '#ff4d00',
  'asimov-tangerine': '#ff8040',
  'asimov-crimson': '#ff1a5e',
  'asimov-lime': '#9fe870',
  'asimov-fern': '#5fd43a',
  'asimov-gold': '#d9b32d',
  'asimov-butter': '#ffe566',
  'asimov-periwinkle': '#8fb8ff',
  'asimov-cobalt': '#4a7fe8',
  'asimov-blush': '#ffc5d7',
  'asimov-midnight': '#1c1a2e',
  'asimov-ivory': '#f7f3ed',
}

/**
 * Canonical categorical order: the CSS declaration order of the swatch file.
 * Stable category ordering maps onto this array by index (see
 * `asimov-visualization-theme.ts`), so a dataset or submode switch never
 * recolors the same category identity.
 */
export const ASIMOV_CATEGORICAL_SWATCH_ORDER = Object.keys(
  ASIMOV_VISUALIZATION_SWATCH_VALUES,
) as AsimovVisualizationSwatch[]

/**
 * Midnight and ivory are surface-adjacent (near-text / near-canvas) and are
 * excluded from the categorical SERIES range; they remain available as
 * explicit named swatches. The series range keeps canonical order.
 */
export const ASIMOV_CATEGORICAL_SERIES_ORDER = ASIMOV_CATEGORICAL_SWATCH_ORDER.filter(
  (swatch) => swatch !== 'asimov-midnight' && swatch !== 'asimov-ivory',
)
