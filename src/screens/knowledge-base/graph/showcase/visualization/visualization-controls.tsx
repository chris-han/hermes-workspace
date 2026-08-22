/**
 * Visualization Controls — the chart sibling of `SigmaControls` (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, §9.2/W3).
 *
 * Shares the Sigma Controls gear trigger and popover styling
 * (`sigma-controls-*` classes) so chart and graph views speak one workbench
 * control language. Every mutation is a schema-validated patch against
 * `VisualizationControlState`; unsupported mutations fail closed (W6). Only
 * semantic/product-safe settings are exposed — controls a chart type does
 * not support are absent, not disabled clutter. The AI-mediated path (§9.3,
 * W6-04) is deferred.
 */

import { useState } from 'react'
import type { CSSProperties } from 'react'

import { applyVisualizationControlPatch } from './visualization-control-state'
import type { VisualizationControlState } from './visualization-control-state'

import { Gear } from '@/components/ui/icon'

type ToggleRowProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  testId?: string
  title?: string
}

function ToggleRow({ label, checked, onChange, testId, title }: ToggleRowProps) {
  return (
    <div className="sigma-control-row" title={title}>
      <span className="sigma-control-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        className="showcase-ref-edge-toggle sigma-control-toggle"
        onClick={() => onChange(!checked)}
      >
        <span className="showcase-ref-edge-toggle-thumb" aria-hidden="true" />
        <span className="showcase-ref-edge-toggle-label">{checked ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  )
}

function SliderRow({
  label,
  value,
  onChange,
  testId,
  title,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  testId?: string
  title?: string
}) {
  return (
    <label className="sigma-control-row" title={title}>
      <span className="sigma-control-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        data-testid={testId}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="asimov-slider"
        style={{ '--asimov-slider-progress': `${value}%` } as CSSProperties}
      />
    </label>
  )
}

export function VisualizationControls({
  controls,
  onControlsChange,
  title = 'Visualization Controls',
}: {
  controls: VisualizationControlState
  onControlsChange: (next: VisualizationControlState) => void
  title?: string
}) {
  const [open, setOpen] = useState(false)
  // All commits route through the fail-closed schema validator: an invalid
  // patch leaves the current state untouched.
  const patch = (next: unknown) => {
    const { state } = applyVisualizationControlPatch(controls, next)
    if (state !== controls) onControlsChange(state)
  }

  return (
    <div className="sigma-controls-root">
      <button
        type="button"
        className={`showcase-ref-canvas-icon-button${open ? ' is-active' : ''}`}
        aria-label={`Open ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-testid="visualization-controls-toggle"
      >
        <Gear size={14} />
      </button>

      {open ? (
        <div className="sigma-controls-popover" role="dialog" aria-label={title}>
          <div className="sigma-controls-header">
            <div>
              <div className="sigma-controls-title">{title}</div>
              <div className="sigma-controls-subtitle">Canonical Asimov chart theme &amp; layout</div>
            </div>
            <button type="button" className="sigma-controls-close" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <div className="sigma-controls-grid">
            <section className="sigma-controls-group">
              <h3>Visual</h3>
              <ToggleRow
                label="Border"
                checked={controls.border}
                onChange={(value) => patch({ border: value })}
                testId="visualization-control-border"
                title="Structural 1px viewport border (flat depth model)."
              />
              <ToggleRow
                label="Grid align"
                checked={controls.snapLayoutToGrid}
                onChange={(value) => patch({ snapLayoutToGrid: value })}
                testId="visualization-control-grid-align"
                title="Snap presentation geometry to the 24px visualization lattice. Data geometry is never snapped."
              />
            </section>

            <section className="sigma-controls-group">
              <h3>Mark</h3>
              <SliderRow
                label="Size"
                value={Math.round((controls.mark.size / 24) * 100)}
                onChange={(value) => patch({ mark: { size: Math.max(1, Math.round((value / 100) * 24)) } })}
                testId="visualization-control-mark-size"
              />
              <SliderRow
                label="Opacity"
                value={controls.mark.opacity}
                onChange={(value) => patch({ mark: { opacity: value } })}
                testId="visualization-control-mark-opacity"
              />
            </section>

            <section className="sigma-controls-group">
              <h3>Axes</h3>
              <ToggleRow
                label="X axis"
                checked={controls.axes.x}
                onChange={(value) => patch({ axes: { x: value } })}
                testId="visualization-control-axis-x"
              />
              <ToggleRow
                label="Y axis"
                checked={controls.axes.y}
                onChange={(value) => patch({ axes: { y: value } })}
                testId="visualization-control-axis-y"
              />
              <ToggleRow
                label="Guides"
                checked={controls.axes.guides}
                onChange={(value) => patch({ axes: { guides: value } })}
                testId="visualization-control-guides"
              />
              <ToggleRow
                label="Labels"
                checked={controls.axes.labels}
                onChange={(value) => patch({ axes: { labels: value } })}
                testId="visualization-control-axis-labels"
              />
            </section>

            <section className="sigma-controls-group">
              <h3>Interaction</h3>
              <ToggleRow
                label="Hover"
                checked={controls.interaction.hover}
                onChange={(value) => patch({ interaction: { hover: value } })}
                testId="visualization-control-hover"
              />
              <ToggleRow
                label="Selection"
                checked={controls.interaction.select}
                onChange={(value) => patch({ interaction: { select: value } })}
                testId="visualization-control-select"
              />
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
