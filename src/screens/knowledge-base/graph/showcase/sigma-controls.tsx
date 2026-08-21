import { useMemo, useState } from 'react'
import { Menu } from '@base-ui/react/menu'

import type { CSSProperties } from 'react'

import { CaretDown, CheckCircle, Gear } from '@/components/ui/icon'

import type { GraphTopologyMode } from '../layouts/graph-topology-layouts'
import {
  ASIMOV_VISUALIZATION_SWATCH_VARS,
  ASIMOV_VISUALIZATION_SWATCH_TOKENS,
  type AsimovVisualizationSwatch,
  type SigmaControlState,
} from './sigma-control-state'

type SliderControlProps = {
  label: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  title?: string
}

type ToggleControlProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  title?: string
}

type SigmaControlsProps = {
  topology: GraphTopologyMode
  onTopologyChange: (next: GraphTopologyMode) => void
  controls: SigmaControlState
  onControlsChange: (next: SigmaControlState) => void
}

type DropdownOption = {
  value: string
  label: string
  swatches?: readonly string[]
  swatch?: string
}

type AsimovDropdownProps = {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  ariaLabel: string
}

const TOPOLOGY_TO_LAYOUT: Record<GraphTopologyMode, string> = {
  layout: 'force-directed',
  'force-directed': 'force-directed',
  hierarchical: 'hierarchical',
  radial: 'radial',
  circular: 'circular',
  communities: 'communities',
}

const LAYOUT_TO_TOPOLOGY: Record<string, GraphTopologyMode> = {
  'force-directed': 'force-directed',
  hierarchical: 'hierarchical',
  radial: 'radial',
  circular: 'circular',
  communities: 'communities',
}

function sliderProgress(value: number): CSSProperties {
  return { '--asimov-slider-progress': `${value}%` } as CSSProperties
}

function SliderControl({ label, value, onChange, disabled, title }: SliderControlProps) {
  return (
    <label className="sigma-control-row" title={title}>
      <span className="sigma-control-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="asimov-slider"
        style={sliderProgress(value)}
      />
    </label>
  )
}

function ToggleControl({ label, checked, onChange, disabled, title }: ToggleControlProps) {
  return (
    <div className="sigma-control-row" title={title}>
      <span className="sigma-control-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="showcase-ref-edge-toggle sigma-control-toggle"
        onClick={() => onChange(!checked)}
      >
        <span className="showcase-ref-edge-toggle-thumb" aria-hidden="true" />
        <span className="showcase-ref-edge-toggle-label">{checked ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  )
}

function PaletteStrip({ colors }: { colors: readonly string[] }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-flex', gap: 2, alignItems: 'center', flex: 'none' }}
    >
      {colors.map((color) => (
        <span
          key={color}
          style={{
            width: 6,
            height: 12,
            borderRadius: 1,
            backgroundColor: color,
            border: '1px solid rgb(26 27 30 / 12%)',
          }}
        />
      ))}
    </span>
  )
}

function AsimovDropdown({ value, options, onChange, ariaLabel }: AsimovDropdownProps) {
  const selected = options.find((option) => option.value === value)
  return (
    <Menu.Root>
      <Menu.Trigger className="sigma-dropdown-trigger" aria-label={ariaLabel}>
        <span style={{ display: 'inline-flex', minWidth: 0, alignItems: 'center', gap: 7 }}>
          {selected?.swatches ? <PaletteStrip colors={selected.swatches} /> : null}
          {!selected?.swatches && selected?.swatch ? (
            <span
              className="sigma-dropdown-swatch"
              style={{ backgroundColor: selected.swatch }}
              aria-hidden="true"
            />
          ) : null}
          <span>{selected?.label ?? 'Select'}</span>
        </span>
        <CaretDown size={12} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" className="sigma-dropdown-positioner">
          <Menu.Popup className="sigma-dropdown-menu">
            <Menu.RadioGroup value={value} onValueChange={onChange}>
              {options.map((option) => (
                <Menu.RadioItem key={option.value} value={option.value} className="sigma-dropdown-option">
                  <span style={{ display: 'inline-flex', minWidth: 0, alignItems: 'center', gap: 7 }}>
                    {option.swatches ? <PaletteStrip colors={option.swatches} /> : null}
                    {!option.swatches && option.swatch ? (
                      <span
                        className="sigma-dropdown-swatch"
                        style={{ backgroundColor: option.swatch }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span>{option.label}</span>
                  </span>
                  <Menu.RadioItemIndicator className="sigma-dropdown-check">
                    <CheckCircle size={12} />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function DropdownRow(props: AsimovDropdownProps & { label: string }) {
  return (
    <div className="sigma-control-row">
      <span className="sigma-control-label">{props.label}</span>
      <AsimovDropdown {...props} />
    </div>
  )
}

function visualizationColorOptions(): DropdownOption[] {
  return [
    { value: 'semantic', label: 'Semantica' },
    { value: 'asimov', label: 'Asimov', swatches: ASIMOV_VISUALIZATION_SWATCH_VARS },
    { value: 'uniform', label: 'Uniform' },
    ...(
      Object.entries(ASIMOV_VISUALIZATION_SWATCH_TOKENS) as Array<
        [AsimovVisualizationSwatch, string]
      >
    ).map(([value, token]) => ({
      value,
      label: value.replace('asimov-', '').replace(/^./, (character) => character.toUpperCase()),
      swatch: `var(${token})`,
    })),
  ]
}

export function SigmaControls({
  topology,
  onTopologyChange,
  controls,
  onControlsChange,
}: SigmaControlsProps) {
  const [open, setOpen] = useState(false)
  const selectedLayout = useMemo(
    () => TOPOLOGY_TO_LAYOUT[topology] ?? 'force-directed',
    [topology],
  )
  const colorOptions = useMemo(() => visualizationColorOptions(), [])
  const update = <K extends keyof SigmaControlState>(key: K, value: SigmaControlState[K]) => {
    onControlsChange({ ...controls, [key]: value })
  }

  return (
    <div className="sigma-controls-root">
      <button
        type="button"
        className={`showcase-ref-canvas-icon-button${open ? ' is-active' : ''}`}
        aria-label="Open Sigma Controls"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-testid="sigma-controls-toggle"
      >
        <Gear size={14} />
      </button>

      {open ? (
        <div className="sigma-controls-popover" role="dialog" aria-label="Sigma Controls">
          <div className="sigma-controls-header">
            <div>
              <div className="sigma-controls-title">Sigma Controls</div>
              <div className="sigma-controls-subtitle">Graph exploration &amp; visual encoding</div>
            </div>
            <button type="button" className="sigma-controls-close" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <div className="sigma-controls-grid">
            <section className="sigma-controls-group">
              <h3>View</h3>
              <DropdownRow
                label="Layout"
                ariaLabel="Layout"
                value={selectedLayout}
                onChange={(value) => {
                  const next = LAYOUT_TO_TOPOLOGY[value]
                  if (next) onTopologyChange(next)
                }}
                options={[
                  { value: 'force-directed', label: 'Explore · Force' },
                  { value: 'hierarchical', label: 'Hierarchy' },
                  { value: 'radial', label: 'Radial Focus' },
                  { value: 'circular', label: 'Circular' },
                  { value: 'communities', label: 'Communities' },
                ]}
              />
              <DropdownRow
                label="Direction"
                ariaLabel="Direction"
                value={controls.direction}
                onChange={(value) => update('direction', value as SigmaControlState['direction'])}
                options={[
                  { value: 'LR', label: 'Left → Right' },
                  { value: 'RL', label: 'Right → Left' },
                  { value: 'TB', label: 'Top → Bottom' },
                  { value: 'BT', label: 'Bottom → Top' },
                ]}
              />
              <DropdownRow
                label="Focus"
                ariaLabel="Focus"
                value={controls.focus}
                onChange={(value) => update('focus', value as SigmaControlState['focus'])}
                options={[
                  { value: 'entire', label: 'Entire graph' },
                  { value: 'neighbors', label: 'Direct neighbors' },
                  { value: 'two-hop', label: '2 hops' },
                  { value: 'incoming', label: 'Incoming' },
                  { value: 'outgoing', label: 'Outgoing' },
                ]}
              />
            </section>

            <section className="sigma-controls-group">
              <h3>Interaction &amp; Layout</h3>
              <div className="sigma-control-row" title="The showcase renderer is readonly; node/branch dragging belongs to the interactive Studio renderer.">
                <span className="sigma-control-label">Drag</span>
                <div className="sigma-control-segment">
                  <button type="button" disabled>Node</button>
                  <button type="button" disabled>Branch</button>
                </div>
              </div>
              <ToggleControl label="Pin drop" checked={false} onChange={() => undefined} disabled title="Unavailable in readonly showcase renderer." />
              <ToggleControl label="Rotate" checked={false} onChange={() => undefined} disabled title="Semantic direction is controlled by Direction, not camera rotation." />
              <SliderControl label="Spacing" value={controls.spacing} onChange={(value) => update('spacing', value)} />
              <SliderControl label="Gravity" value={controls.gravity} onChange={(value) => update('gravity', value)} />
              <ToggleControl label="Overlap" checked={true} onChange={() => undefined} disabled title="Overlap prevention requires an interactive layout worker." />
            </section>

            <section className="sigma-controls-group">
              <h3>Nodes &amp; Edges</h3>
              <DropdownRow
                label="Node color"
                ariaLabel="Node color"
                value={controls.nodeColor}
                onChange={(value) => update('nodeColor', value as SigmaControlState['nodeColor'])}
                options={colorOptions}
              />
              <DropdownRow
                label="Node size"
                ariaLabel="Node size"
                value={controls.nodeSize}
                onChange={(value) => update('nodeSize', value as SigmaControlState['nodeSize'])}
                options={[
                  { value: 'degree', label: 'Degree' },
                  { value: 'uniform', label: 'Uniform' },
                ]}
              />
              <DropdownRow
                label="Edge color"
                ariaLabel="Edge color"
                value={controls.edgeColor}
                onChange={(value) => update('edgeColor', value as SigmaControlState['edgeColor'])}
                options={colorOptions}
              />
              <SliderControl
                label="Edge width"
                value={controls.edgeWidth}
                onChange={(value) => update('edgeWidth', value)}
                title="Scale all edge widths proportionally. 50 preserves the source width; 100 doubles it."
              />
              <ToggleControl label="Arrows" checked={controls.edgeArrows} onChange={(value) => update('edgeArrows', value)} />
              <ToggleControl label="Curved" checked={false} onChange={() => undefined} disabled title="Curved edge program is not registered in the readonly renderer." />
            </section>

            <section className="sigma-controls-group">
              <h3>Labels &amp; Filter</h3>
              <DropdownRow
                label="Node labels"
                ariaLabel="Node labels"
                value={controls.nodeLabels}
                onChange={(value) => update('nodeLabels', value as SigmaControlState['nodeLabels'])}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'selected', label: 'Selected + neighbors' },
                  { value: 'none', label: 'None' },
                ]}
              />
              <DropdownRow
                label="Edge labels"
                ariaLabel="Edge labels"
                value={controls.edgeLabels}
                onChange={(value) => update('edgeLabels', value as SigmaControlState['edgeLabels'])}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'selected', label: 'Selected' },
                  { value: 'neighborhood', label: 'Neighborhood' },
                  { value: 'none', label: 'None' },
                ]}
              />
              <ToggleControl
                label="Properties"
                checked={controls.showProperties}
                onChange={(value) => update('showProperties', value)}
                title="Show node and edge properties directly on the Sigma canvas."
              />
              <SliderControl label="Confidence" value={25} onChange={() => undefined} disabled title="Current showcase fixtures do not carry edge confidence." />
              <details>
                <summary>Advanced Layout</summary>
                <div className="sigma-controls-advanced">
                  <SliderControl label="Scale" value={controls.scale} onChange={(value) => update('scale', value)} />
                  <ToggleControl label="Barnes-Hut" checked={false} onChange={() => undefined} disabled title="The showcase uses deterministic positions rather than a live ForceAtlas2 worker." />
                </div>
              </details>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
