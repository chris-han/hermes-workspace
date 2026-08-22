/**
 * Asimov chart compiler — Recharts/SVG fallback engine (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, §7.1
 * FALLBACK active per W0 Decision 2: no Vega dependency).
 *
 * This module is the fallback-path substitute for the plan's
 * `visualization/vega/*` compiler: a deterministic pure function
 *   semantic control state + AsimovVisualizationTheme_v1
 *     → renderer-ready Recharts/SVG prop configuration (A12).
 * Same input always compiles to a deeply-equal output. Chart views consume
 * the compiled config and must not restyle after compilation (§7.2) or keep
 * renderer-local spacing/color literals (A3/A4).
 */

import {
  ASIMOV_VISUALIZATION_THEME
  
} from '../asimov-visualization-theme'
import type {AsimovVisualizationTheme} from '../asimov-visualization-theme';
import type { VisualizationControlState } from '../visualization-control-state'

export interface AsimovChartConfig {
  renderer: 'recharts-svg' | 'svg'
  background: 'transparent'
  border: string | 'none'
  fonts: {
    label: string
    value: string
    title: string
  }
  colors: {
    categorical: readonly string[]
    text: string
    textMuted: string
    guide: string
  }
  axis: {
    visibleX: boolean
    visibleY: boolean
    guides: boolean
    labels: boolean
    tick: { fontSize: number; fontFamily: string; fill: string }
  }
  mark: {
    type: 'point' | 'bar' | 'line' | 'rule'
    size: number
    opacity: number
    strokeWidth: number
  }
  guide: {
    stroke: string
    strokeDasharray: string
    opacity: number
  }
  geometry: AsimovVisualizationTheme['geometry']
  interaction: VisualizationControlState['interaction']
}

/**
 * Deterministic compiler: pure in (control state, theme) / out (config).
 * `snapLayoutToGrid = false` still returns the lattice tokens but signals the
 * renderer to skip snapping presentation geometry; data geometry is never
 * snapped in either mode (A1).
 */
export function compileAsimovChartConfig(
  controls: VisualizationControlState,
  theme: AsimovVisualizationTheme = ASIMOV_VISUALIZATION_THEME,
): AsimovChartConfig {
  return {
    renderer: controls.renderer === 'recharts-svg' ? 'recharts-svg' : 'svg',
    background: 'transparent',
    border: controls.border ? theme.surfaces.border : 'none',
    fonts: {
      label: theme.typography.labelFont,
      value: theme.typography.valueFont,
      title: theme.typography.titleFont,
    },
    colors: {
      categorical: theme.series,
      text: theme.surfaces.text,
      textMuted: theme.surfaces.textMuted,
      guide: 'var(--asimov-outline-variant)',
    },
    axis: {
      visibleX: controls.axes.x,
      visibleY: controls.axes.y,
      guides: controls.axes.guides,
      labels: controls.axes.labels,
      tick: { fontSize: 10, fontFamily: theme.typography.valueFont, fill: theme.surfaces.textMuted },
    },
    mark: {
      type: controls.mark.type,
      size: controls.mark.size,
      opacity: controls.mark.opacity / 100,
      strokeWidth: controls.mark.strokeWidth,
    },
    guide: {
      stroke: 'var(--asimov-outline-variant)',
      strokeDasharray: '2 4',
      opacity: theme.marks.guideOpacity,
    },
    geometry: theme.geometry,
    interaction: { ...controls.interaction },
  }
}

/** Canonical categorical color for a zero-based series/lane index. */
export function asimovSeriesColor(
  index: number,
  theme: AsimovVisualizationTheme = ASIMOV_VISUALIZATION_THEME,
): string {
  const range = theme.series
  return range[((index % range.length) + range.length) % range.length]
}
