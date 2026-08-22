/**
 * Shared Asimov visualization footer (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, §8.2/W3).
 *
 * Per-canvas footer extracted from the Sigma canvas-footer geometry
 * (`showcase-ref-canvas-footer` in `asimov-minimalism.css`): border-top,
 * mono caps labels, snapped height on the 24px lattice. Chart and graph
 * views share this geometry; renderer-specific label/summary text varies,
 * geometry does not (A8). The footer never duplicates the screen-level
 * dataset status bar content.
 */

import {
  CHART_ZOOM_MAX,
  CHART_ZOOM_MIN,
  CHART_ZOOM_STEP,
  applyVisualizationControlPatch,
} from './visualization-control-state'
import type { ReactNode } from 'react'
import type { VisualizationControlState } from './visualization-control-state'
import { VisualizationControls } from './visualization-controls'

export function VisualizationFooter({
  rendererTag,
  summary,
  interactions,
  controls,
  testId,
}: {
  /** Mono caps renderer tag, e.g. `SVG` / `RECHARTS · SVG` / `SIGMA · WEBGL`. */
  rendererTag: string
  /** Chart/layout type label, e.g. `Swimlane` / `Ranked bars` / `Force-directed`. */
  summary: string
  /** Optional chart interaction control group (MODE / ZOOM / FIT). */
  interactions?: ReactNode
  /** Control entry point (gear trigger) mounted at the right. */
  controls?: ReactNode
  testId?: string
}) {
  return (
    <div
      className="showcase-ref-canvas-footer showcase-viz-footer"
      data-testid={testId ?? 'visualization-footer'}
      aria-label="Visualization footer"
    >
      <div className="showcase-ref-canvas-group">
        <span className="showcase-ref-canvas-label">{rendererTag}</span>
        <span className="showcase-viz-footer-summary">{summary}</span>
      </div>
      {interactions}
      {controls ? <div className="showcase-ref-canvas-group">{controls}</div> : null}
    </div>
  )
}

/**
 * Chart footer control parity with the Sigma canvas footer
 * (`semantica-showcase-screen.tsx` `showcase-ref-canvas-footer`): MODE
 * (View/Select), ZOOM (- / factor / +), FIT, and the gear all live together
 * in the right-hand group, separated by dividers — exactly the Sigma layout.
 * Graph-only groups (LAYOUT, PATH, NUDGE, EDGES) are absent, not disabled.
 * Every mutation routes through the fail-closed `VisualizationControlState`
 * patch path (A9/W6).
 */
export function ChartVisualizationFooter({
  rendererTag,
  summary,
  controls,
  onControlsChange,
  testId,
}: {
  rendererTag: string
  summary: string
  controls: VisualizationControlState
  onControlsChange: (next: VisualizationControlState) => void
  testId?: string
}) {
  const patchInteraction = (patch: Record<string, unknown>) => {
    const { state } = applyVisualizationControlPatch(controls, { interaction: patch })
    if (state !== controls) onControlsChange(state)
  }
  const { mode, zoomFactor, zoom } = controls.interaction
  const zoomLabel = `${zoomFactor.toFixed(1)}x`
  return (
    <VisualizationFooter
      rendererTag={rendererTag}
      summary={summary}
      testId={testId}
      controls={
        <>
          <span className="showcase-ref-canvas-label">MODE</span>
          <button
            type="button"
            aria-pressed={mode === 'view'}
            className={mode === 'view' ? 'is-active' : ''}
            onClick={() => patchInteraction({ mode: 'view', select: false })}
            data-testid="chart-mode-view"
          >
            View
          </button>
          <button
            type="button"
            aria-pressed={mode === 'select'}
            className={mode === 'select' ? 'is-active' : ''}
            onClick={() => patchInteraction({ mode: 'select', select: true })}
            data-testid="chart-mode-select"
          >
            Select
          </button>
          <span className="showcase-ref-canvas-separator" aria-hidden="true" />
          <span className="showcase-ref-canvas-label">ZOOM</span>
          <button
            type="button"
            className="showcase-ref-canvas-zoom"
            onClick={() => patchInteraction({ zoomFactor: zoomFactor / CHART_ZOOM_STEP })}
            disabled={!zoom || zoomFactor <= CHART_ZOOM_MIN}
            data-testid="chart-zoom-out"
          >
            -
          </button>
          <span className="showcase-ref-canvas-zoom-value" data-testid="chart-zoom-value">
            {zoomLabel}
          </span>
          <button
            type="button"
            className="showcase-ref-canvas-zoom"
            onClick={() => patchInteraction({ zoomFactor: zoomFactor * CHART_ZOOM_STEP })}
            disabled={!zoom || zoomFactor >= CHART_ZOOM_MAX}
            data-testid="chart-zoom-in"
          >
            +
          </button>
          <span className="showcase-ref-canvas-separator" aria-hidden="true" />
          <button
            type="button"
            className="is-caps"
            onClick={() => patchInteraction({ zoomFactor: CHART_ZOOM_MIN })}
            disabled={!zoom || zoomFactor <= CHART_ZOOM_MIN}
            data-testid="chart-fit"
          >
            FIT
          </button>
          <span className="showcase-ref-canvas-separator" aria-hidden="true" />
          <VisualizationControls controls={controls} onControlsChange={onControlsChange} />
        </>
      }
    />
  )
}
