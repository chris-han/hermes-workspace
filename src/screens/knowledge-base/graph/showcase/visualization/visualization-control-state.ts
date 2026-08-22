/**
 * Renderer-neutral visualization control contract (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, §9).
 *
 * `VisualizationControlState` is the ONLY product-level control surface: UI
 * (and later AI, deferred per §9.3/W6-04) patches this validated state, never
 * arbitrary Vega-Lite specs, renderer props, or Sigma internals (A9). The
 * chart engine is Vega-Lite (plan
 * `2026-08-22-semantica-vega-lite-chart-engine-v1`, which amends the parent
 * plan's §7.1 Recharts/SVG fallback), so the renderer enum carries
 * `'vega-svg' | 'sigma'`.
 *
 * Validation is fail-closed: unknown keys, wrong enum values, or out-of-range
 * numbers are rejected and the previous state is kept.
 */

import { ASIMOV_GRID_UNIT_PX } from './asimov-visualization-spatial'

export type VisualizationRendererId = 'vega-svg' | 'sigma'

export type VisualizationMarkType = 'point' | 'bar' | 'line' | 'rule'

export interface VisualizationControlState {
  renderer: VisualizationRendererId
  background: 'transparent'
  border: boolean
  snapLayoutToGrid: boolean
  gridUnitPx: number
  palette: 'asimov-12'
  axes: {
    x: boolean
    y: boolean
    guides: boolean
    labels: boolean
  }
  mark: {
    type: VisualizationMarkType
    size: number
    opacity: number
    strokeWidth: number
  }
  interaction: {
    hover: boolean
    select: boolean
    zoom: boolean
    pan: boolean
    /** Deterministic viewport zoom factor (1 = full data extent). */
    zoomFactor: number
    /** Canvas mode: `view` = hover only; `select` = mark click-to-inspect. */
    mode: 'view' | 'select'
  }
}

export const CHART_ZOOM_MIN = 1
export const CHART_ZOOM_MAX = 4
export const CHART_ZOOM_STEP = 1.25

export const DEFAULT_VISUALIZATION_CONTROL_STATE: VisualizationControlState = {
  renderer: 'vega-svg',
  background: 'transparent',
  border: true,
  snapLayoutToGrid: true,
  gridUnitPx: ASIMOV_GRID_UNIT_PX,
  palette: 'asimov-12',
  axes: { x: true, y: true, guides: true, labels: true },
  mark: { type: 'point', size: 5, opacity: 90, strokeWidth: 1.5 },
  interaction: { hover: true, select: false, zoom: true, pan: true, zoomFactor: CHART_ZOOM_MIN, mode: 'view' },
}

const RENDERERS: readonly VisualizationRendererId[] = ['vega-svg', 'sigma']
const MARK_TYPES: readonly VisualizationMarkType[] = ['point', 'bar', 'line', 'rule']

const TOP_LEVEL_KEYS = new Set([
  'renderer',
  'background',
  'border',
  'snapLayoutToGrid',
  'gridUnitPx',
  'palette',
  'axes',
  'mark',
  'interaction',
])
const AXES_KEYS = new Set(['x', 'y', 'guides', 'labels'])
const MARK_KEYS = new Set(['type', 'size', 'opacity', 'strokeWidth'])
const INTERACTION_KEYS = new Set(['hover', 'select', 'zoom', 'pan', 'zoomFactor', 'mode'])
const INTERACTION_MODES = ['view', 'select'] as const

export type VisualizationControlValidation =
  | { ok: true; state: VisualizationControlState }
  | { ok: false; errors: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateBooleanGroup(
  value: unknown,
  path: string,
  allowedKeys: Set<string>,
  errors: string[],
): Record<string, boolean> | null {
  if (!isRecord(value)) {
    errors.push(`${path}: expected an object`)
    return null
  }
  const result: Record<string, boolean> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${path}.${key}: unsupported control mutation`)
      continue
    }
    if (typeof entry !== 'boolean') {
      errors.push(`${path}.${key}: expected a boolean`)
      continue
    }
    result[key] = entry
  }
  return result
}

/**
 * Schema-validate a full or partial control-state patch. Unknown keys and
 * invalid values are collected as errors; valid fields are merged over
 * `base`. The result is `ok` only when every supplied field is supported.
 */
export function validateVisualizationControlPatch(
  patch: unknown,
  base: VisualizationControlState = DEFAULT_VISUALIZATION_CONTROL_STATE,
): VisualizationControlValidation {
  const errors: string[] = []
  if (!isRecord(patch)) {
    return { ok: false, errors: ['patch: expected an object'] }
  }
  const state: VisualizationControlState = {
    ...base,
    axes: { ...base.axes },
    mark: { ...base.mark },
    interaction: { ...base.interaction },
  }
  for (const [key, value] of Object.entries(patch)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      errors.push(`${key}: unsupported control mutation`)
      continue
    }
    switch (key) {
      case 'renderer':
        if (RENDERERS.includes(value as VisualizationRendererId)) {
          state.renderer = value as VisualizationRendererId
        } else {
          errors.push(`renderer: expected one of ${RENDERERS.join(', ')}`)
        }
        break
      case 'background':
        // A6: the viewport background is pinned transparent; any other value
        // is an unsupported mutation and fails closed.
        if (value === 'transparent') {
          state.background = 'transparent'
        } else {
          errors.push("background: only 'transparent' is supported")
        }
        break
      case 'border':
      case 'snapLayoutToGrid':
        if (typeof value === 'boolean') {
          state[key] = value
        } else {
          errors.push(`${key}: expected a boolean`)
        }
        break
      case 'gridUnitPx':
        // A2: the lattice is an integer multiple of the 8px base unit.
        if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value % 8 === 0) {
          state.gridUnitPx = value
        } else {
          errors.push('gridUnitPx: expected a positive integer multiple of 8')
        }
        break
      case 'palette':
        // A4: one categorical source of truth; alternates fail closed.
        if (value === 'asimov-12') {
          state.palette = 'asimov-12'
        } else {
          errors.push("palette: only 'asimov-12' is supported")
        }
        break
      case 'axes': {
        const group = validateBooleanGroup(value, 'axes', AXES_KEYS, errors)
        if (group) state.axes = { ...state.axes, ...group }
        break
      }
      case 'mark': {
        if (!isRecord(value)) {
          errors.push('mark: expected an object')
          break
        }
        for (const [markKey, markValue] of Object.entries(value)) {
          if (!MARK_KEYS.has(markKey)) {
            errors.push(`mark.${markKey}: unsupported control mutation`)
            continue
          }
          if (markKey === 'type') {
            if (MARK_TYPES.includes(markValue as VisualizationMarkType)) {
              state.mark.type = markValue as VisualizationMarkType
            } else {
              errors.push(`mark.type: expected one of ${MARK_TYPES.join(', ')}`)
            }
            continue
          }
          if (typeof markValue !== 'number' || !Number.isFinite(markValue)) {
            errors.push(`mark.${markKey}: expected a finite number`)
            continue
          }
          if (markKey === 'size') state.mark.size = Math.min(24, Math.max(1, markValue))
          if (markKey === 'opacity') state.mark.opacity = Math.min(100, Math.max(0, markValue))
          if (markKey === 'strokeWidth') state.mark.strokeWidth = Math.min(8, Math.max(0.5, markValue))
        }
        break
      }
      case 'interaction': {
        if (!isRecord(value)) {
          errors.push('interaction: expected an object')
          break
        }
        for (const [interactionKey, interactionValue] of Object.entries(value)) {
          if (!INTERACTION_KEYS.has(interactionKey)) {
            errors.push(`interaction.${interactionKey}: unsupported control mutation`)
            continue
          }
          if (interactionKey === 'zoomFactor') {
            if (typeof interactionValue !== 'number' || !Number.isFinite(interactionValue)) {
              errors.push('interaction.zoomFactor: expected a finite number')
              continue
            }
            // Deterministic clamp into the supported chart zoom range.
            state.interaction.zoomFactor = Math.min(
              CHART_ZOOM_MAX,
              Math.max(CHART_ZOOM_MIN, Math.round(interactionValue * 1000) / 1000),
            )
            continue
          }
          if (interactionKey === 'mode') {
            if (INTERACTION_MODES.includes(interactionValue as (typeof INTERACTION_MODES)[number])) {
              state.interaction.mode = interactionValue as 'view' | 'select'
            } else {
              errors.push(`interaction.mode: expected one of ${INTERACTION_MODES.join(', ')}`)
            }
            continue
          }
          if (typeof interactionValue !== 'boolean') {
            errors.push(`interaction.${interactionKey}: expected a boolean`)
            continue
          }
          state.interaction[interactionKey as 'hover' | 'select' | 'zoom' | 'pan'] = interactionValue
        }
        break
      }
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, state }
}

/**
 * Fail-closed patch application: on ANY validation error the current state is
 * returned unchanged, so an unsupported mutation never partially applies.
 */
export function applyVisualizationControlPatch(
  current: VisualizationControlState,
  patch: unknown,
): { state: VisualizationControlState; errors: string[] } {
  const result = validateVisualizationControlPatch(patch, current)
  if (!result.ok) return { state: current, errors: result.errors }
  return { state: result.state, errors: [] }
}
