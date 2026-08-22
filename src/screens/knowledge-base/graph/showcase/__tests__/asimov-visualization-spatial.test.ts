/**
 * W1/W7-04: canonical Asimov visualization spatial contract tests.
 *
 * The lattice is 24px = 3 × the 8px authenticated base unit (DESIGN.md §6,
 * plan W0 Decision 1). Presentation geometry snaps; data geometry never does.
 */

import { describe, expect, it } from 'vitest'

import {
  ASIMOV_GRID_HALF_STEP_PX,
  ASIMOV_GRID_UNIT_PX,
  ASIMOV_VISUALIZATION_SPATIAL,
  asimovLaneBaselineY,
  asimovLaneBlockHeight,
  nextAsimovGridLine,
  snapRectToAsimovGrid,
  snapSizeToAsimovGrid,
  snapToAsimovGrid,
} from '../visualization/asimov-visualization-spatial'

describe('asimov visualization spatial tokens', () => {
  it('pins the lattice at 24px = 3 × the 8px base unit', () => {
    expect(ASIMOV_GRID_UNIT_PX).toBe(24)
    expect(ASIMOV_GRID_UNIT_PX % 8).toBe(0)
    expect(ASIMOV_GRID_UNIT_PX / 8).toBe(3)
    expect(ASIMOV_GRID_HALF_STEP_PX).toBe(12)
  })

  it('derives every spatial token as an integer multiple or half-step of the lattice', () => {
    const spatial = ASIMOV_VISUALIZATION_SPATIAL
    expect(spatial.gridUnitPx).toBe(ASIMOV_GRID_UNIT_PX)
    for (const [key, value] of Object.entries(spatial)) {
      const ratio = value / ASIMOV_GRID_UNIT_PX
      const isWhole = Number.isInteger(ratio)
      const isHalfStep = Number.isInteger(ratio * 2)
      expect(isWhole || isHalfStep, `${key}=${value} must be a multiple or half-step of the lattice`).toBe(true)
    }
    expect(spatial.minorStep).toBe(ASIMOV_GRID_UNIT_PX)
    expect(spatial.majorStep % ASIMOV_GRID_UNIT_PX).toBe(0)
    expect(spatial.laneStep % ASIMOV_GRID_UNIT_PX).toBe(0)
  })
})

describe('snap helpers', () => {
  it('snapToAsimovGrid rounds to the nearest lattice line deterministically', () => {
    expect(snapToAsimovGrid(0)).toBe(0)
    expect(snapToAsimovGrid(11)).toBe(0)
    expect(snapToAsimovGrid(13)).toBe(24)
    expect(snapToAsimovGrid(24)).toBe(24)
    expect(snapToAsimovGrid(36)).toBe(48)
    expect(snapToAsimovGrid(-13)).toBe(-24)
    expect(snapToAsimovGrid(720)).toBe(720)
  })

  it('snapSizeToAsimovGrid rounds sizes UP and never below one unit', () => {
    expect(snapSizeToAsimovGrid(0)).toBe(24)
    expect(snapSizeToAsimovGrid(1)).toBe(24)
    expect(snapSizeToAsimovGrid(24)).toBe(24)
    expect(snapSizeToAsimovGrid(25)).toBe(48)
    expect(snapSizeToAsimovGrid(128)).toBe(144)
    expect(snapSizeToAsimovGrid(640)).toBe(648)
  })

  it('snapRectToAsimovGrid snaps origin and grows size onto the lattice', () => {
    expect(snapRectToAsimovGrid({ x: 13, y: 26, width: 100, height: 50 })).toEqual({
      x: 24,
      y: 24,
      width: 120,
      height: 72,
    })
  })

  it('nextAsimovGridLine returns the first line strictly past the input', () => {
    expect(nextAsimovGridLine(0)).toBe(24)
    expect(nextAsimovGridLine(23)).toBe(24)
    expect(nextAsimovGridLine(24)).toBe(48)
    expect(nextAsimovGridLine(47)).toBe(48)
  })

  it('lane baselines and lane block heights are lattice-aligned', () => {
    for (let index = 0; index < 8; index += 1) {
      expect(asimovLaneBaselineY(index) % ASIMOV_GRID_UNIT_PX).toBe(0)
    }
    expect(asimovLaneBaselineY(0)).toBe(24)
    expect(asimovLaneBaselineY(1)).toBe(72)
    for (let count = 1; count <= 6; count += 1) {
      expect(asimovLaneBlockHeight(count) % ASIMOV_GRID_UNIT_PX).toBe(0)
    }
  })
})
