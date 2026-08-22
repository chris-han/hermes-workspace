/**
 * Canonical Asimov visualization spatial contract (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, W1).
 *
 * W0 Decision 1 (spatial): the authenticated base unit stays 8px per
 * `docs/operational/DESIGN.md` §6; the visualization lattice is
 * **24px = 3 × 8px**, surfaced in CSS as `--asimov-grid-unit` and here as
 * `ASIMOV_GRID_UNIT_PX`. The dot grid and all presentation geometry derive
 * from this single token; no renderer-local literal may replace it (A3).
 *
 * A1: the lattice governs PRESENTATION geometry only (viewport bounds, lane
 * baselines, rung Y, panel heights, footer boundary, label/control blocks).
 * Data geometry — timestamps, metric values, centrality scores, graph node
 * coordinates — is NEVER snapped. The snap helpers below must therefore only
 * be applied to presentation coordinates; mark positions stay data-driven.
 */

export const ASIMOV_GRID_UNIT_PX = 24

/** Half-step: the largest sub-lattice increment allowed for tight offsets. */
export const ASIMOV_GRID_HALF_STEP_PX = ASIMOV_GRID_UNIT_PX / 2

export interface AsimovVisualizationSpatialTokens {
  /** Visualization lattice unit in px (3 × the 8px authenticated base unit). */
  gridUnitPx: number
  /** 1 × grid unit. */
  minorStep: number
  /** Major alignment step: dot-grid major lines and large blocks (4 × unit). */
  majorStep: number
  /** Chart viewport horizontal padding (1 × unit). */
  viewportPaddingX: number
  /** Chart viewport vertical padding (1 × unit). */
  viewportPaddingY: number
  /** Per-canvas visualization footer height (2 × unit). */
  footerHeight: number
  /** Gap between footer/control blocks (half-step). */
  controlGap: number
  /** Label baseline offset from a snapped lane/rung line (half-step). */
  labelOffset: number
  /** Vertical distance between categorical lane baselines (2 × unit). */
  laneStep: number
}

export const ASIMOV_VISUALIZATION_SPATIAL: AsimovVisualizationSpatialTokens = {
  gridUnitPx: ASIMOV_GRID_UNIT_PX,
  minorStep: ASIMOV_GRID_UNIT_PX,
  majorStep: ASIMOV_GRID_UNIT_PX * 4,
  viewportPaddingX: ASIMOV_GRID_UNIT_PX,
  viewportPaddingY: ASIMOV_GRID_UNIT_PX,
  footerHeight: ASIMOV_GRID_UNIT_PX * 2,
  controlGap: ASIMOV_GRID_HALF_STEP_PX,
  labelOffset: ASIMOV_GRID_HALF_STEP_PX,
  laneStep: ASIMOV_GRID_UNIT_PX * 2,
}

export interface AsimovGridRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Snap a presentation coordinate to the nearest lattice line. Ties round
 * away from zero (`Math.round` semantics) so the result is deterministic.
 */
export function snapToAsimovGrid(px: number): number {
  return Math.round(px / ASIMOV_GRID_UNIT_PX) * ASIMOV_GRID_UNIT_PX
}

/**
 * Snap a presentation size UP to the next whole lattice multiple so snapped
 * regions never clip their content. Minimum size is one lattice unit.
 */
export function snapSizeToAsimovGrid(px: number): number {
  if (px <= 0) return ASIMOV_GRID_UNIT_PX
  return Math.max(ASIMOV_GRID_UNIT_PX, Math.ceil(px / ASIMOV_GRID_UNIT_PX) * ASIMOV_GRID_UNIT_PX)
}

/**
 * Snap a presentation rect: origin to the nearest lattice line, size up to
 * whole lattice multiples. The result always lies on the lattice and never
 * shrinks below the input extent.
 */
export function snapRectToAsimovGrid(rect: AsimovGridRect): AsimovGridRect {
  return {
    x: snapToAsimovGrid(rect.x),
    y: snapToAsimovGrid(rect.y),
    width: snapSizeToAsimovGrid(rect.width),
    height: snapSizeToAsimovGrid(rect.height),
  }
}

/**
 * The first lattice line strictly greater than `px`. Used to place footer
 * boundaries and axis baselines just past the data extent.
 */
export function nextAsimovGridLine(px: number): number {
  return Math.floor(px / ASIMOV_GRID_UNIT_PX) * ASIMOV_GRID_UNIT_PX + ASIMOV_GRID_UNIT_PX
}

/**
 * Snapped Y baseline for the `index`-th categorical lane/rung, counting from
 * the viewport top padding. Lane baselines are lattice-aligned; event/mark X
 * positions on the lane remain data-driven and are never passed through the
 * snap helpers.
 */
export function asimovLaneBaselineY(index: number, spatial = ASIMOV_VISUALIZATION_SPATIAL): number {
  return snapToAsimovGrid(spatial.viewportPaddingY + index * spatial.laneStep)
}

/** Snapped total height for a block of `count` lanes plus viewport padding. */
export function asimovLaneBlockHeight(count: number, spatial = ASIMOV_VISUALIZATION_SPATIAL): number {
  return snapSizeToAsimovGrid(spatial.viewportPaddingY + Math.max(1, count) * spatial.laneStep)
}
