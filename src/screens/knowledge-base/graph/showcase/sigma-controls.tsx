import { useMemo, useState } from 'react'
import { Menu } from '@base-ui/react/menu'

import type { CSSProperties } from 'react'

import { CaretDown, CheckCircle, Gear } from '@/components/ui/icon'

import type { GraphTopologyMode } from '../layouts/graph-topology-layouts'

type SliderControlProps = {
  label: string
  value: number
  onChange: (value: number) => void
}

type ToggleControlProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

type SigmaControlsProps = {
  topology: GraphTopologyMode
  onTopologyChange: (next: GraphTopologyMode) => void
}

type DropdownOption = { value: string; label: string }

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
}

const LAYOUT_TO_TOPOLOGY: Record<string, GraphTopologyMode> = {
  'force-directed': 'force-directed',
  hierarchical: 'hierarchical',
  radial: 'radial',
}

function sliderProgress(value: number): CSSProperties {
  return { '--asimov-slider-progress': `${value}%` } as CSSProperties
}

function SliderControl({ label, value, onChange }: SliderControlProps) {
  return (
    <label className="sigma-control-row">
      <span className="sigma-control-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="asimov-slider"
        style={sliderProgress(value)}
      />
    </label>
  )
}

function ToggleControl({ label, checked, onChange }: ToggleControlProps) {
  return (
    <div className="sigma-control-row">
      <span className="sigma-control-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className="showcase-ref-edge-toggle sigma-control-toggle"
        onClick={() => onChange(!checked)}
      >
        <span className="showcase-ref-edge-toggle-thumb" aria-hidden="true" />
        <span className="showcase-ref-edge-toggle-label">{checked ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  )
}

function AsimovDropdown({ value, options, onChange, ariaLabel }: AsimovDropdownProps) {
  const selected = options.find((option) => option.value === value)

  return (
    <Menu.Root>
      <Menu.Trigger className="sigma-dropdown-trigger" aria-label={ariaLabel}>
        <span>{selected?.label ?? 'Select'}</span>
        <CaretDown size={12} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" className="sigma-dropdown-positioner">
          <Menu.Popup className="sigma-dropdown-menu">
            <Menu.RadioGroup value={value} onValueChange={onChange}>
              {options.map((option) => (
                <Menu.RadioItem
                  key={option.value}
                  value={option.value}
                  className="sigma-dropdown-option"
                >
                  <span>{option.label}</span>
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

export function SigmaControls({ topology, onTopologyChange }: SigmaControlsProps) {
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState('LR')
  const [focus, setFocus] = useState('entire')
  const [groupBy, setGroupBy] = useState('entity-type')
  const [dragMode, setDragMode] = useState<'node' | 'branch'>('branch')
  const [pinOnDrop, setPinOnDrop] = useState(true)
  const [cameraRotate, setCameraRotate] = useState(false)
  const [preventOverlap, setPreventOverlap] = useState(true)
  const [spacing, setSpacing] = useState(58)
  const [gravity, setGravity] = useState(36)
  const [nodeColor, setNodeColor] = useState('entity-type')
  const [nodeSize, setNodeSize] = useState('degree')
  const [edgeColor, setEdgeColor] = useState('relation-type')
  const [edgeArrows, setEdgeArrows] = useState(true)
  const [curvedEdges, setCurvedEdges] = useState(false)
  const [nodeLabels, setNodeLabels] = useState('auto')
  const [edgeLabels, setEdgeLabels] = useState('selected')
  const [confidence, setConfidence] = useState(25)
  const [barnesHut, setBarnesHut] = useState(true)
  const [scaling, setScaling] = useState(52)

  const selectedLayout = useMemo(
    () => TOPOLOGY_TO_LAYOUT[topology] ?? 'force-directed',
    [topology],
  )

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
                ]}
              />
              <DropdownRow
                label="Direction"
                ariaLabel="Direction"
                value={direction}
                onChange={setDirection}
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
                value={focus}
                onChange={setFocus}
                options={[
                  { value: 'entire', label: 'Entire graph' },
                  { value: 'neighbors', label: 'Direct neighbors' },
                  { value: 'two-hop', label: '2 hops' },
                  { value: 'incoming', label: 'Incoming' },
                  { value: 'outgoing', label: 'Outgoing' },
                  { value: 'path', label: 'Shortest path' },
                ]}
              />
              <DropdownRow
                label="Group"
                ariaLabel="Group by"
                value={groupBy}
                onChange={setGroupBy}
                options={[
                  { value: 'entity-type', label: 'Entity type' },
                  { value: 'community', label: 'Community' },
                  { value: 'semantic-tier', label: 'Semantic tier' },
                  { value: 'source', label: 'Source' },
                  { value: 'none', label: 'None' },
                ]}
              />
            </section>

            <section className="sigma-controls-group">
              <h3>Interaction &amp; Layout</h3>
              <div className="sigma-control-row">
                <span className="sigma-control-label">Drag</span>
                <div className="sigma-control-segment">
                  <button
                    type="button"
                    className={dragMode === 'node' ? 'is-active' : ''}
                    onClick={() => setDragMode('node')}
                  >
                    Node
                  </button>
                  <button
                    type="button"
                    className={dragMode === 'branch' ? 'is-active' : ''}
                    onClick={() => setDragMode('branch')}
                  >
                    Branch
                  </button>
                </div>
              </div>
              <ToggleControl label="Pin drop" checked={pinOnDrop} onChange={setPinOnDrop} />
              <ToggleControl label="Rotate" checked={cameraRotate} onChange={setCameraRotate} />
              <SliderControl label="Spacing" value={spacing} onChange={setSpacing} />
              <SliderControl label="Gravity" value={gravity} onChange={setGravity} />
              <ToggleControl label="Overlap" checked={preventOverlap} onChange={setPreventOverlap} />
            </section>

            <section className="sigma-controls-group">
              <h3>Nodes &amp; Edges</h3>
              <DropdownRow
                label="Node color"
                ariaLabel="Node color"
                value={nodeColor}
                onChange={setNodeColor}
                options={[
                  { value: 'entity-type', label: 'Entity type' },
                  { value: 'community', label: 'Community' },
                  { value: 'semantic-tier', label: 'Semantic tier' },
                  { value: 'source', label: 'Source' },
                ]}
              />
              <DropdownRow
                label="Node size"
                ariaLabel="Node size"
                value={nodeSize}
                onChange={setNodeSize}
                options={[
                  { value: 'degree', label: 'Degree' },
                  { value: 'pagerank', label: 'PageRank' },
                  { value: 'betweenness', label: 'Betweenness' },
                  { value: 'uniform', label: 'Uniform' },
                ]}
              />
              <DropdownRow
                label="Edge color"
                ariaLabel="Edge color"
                value={edgeColor}
                onChange={setEdgeColor}
                options={[
                  { value: 'relation-type', label: 'Relation type' },
                  { value: 'source', label: 'Source' },
                  { value: 'confidence', label: 'Confidence' },
                ]}
              />
              <ToggleControl label="Arrows" checked={edgeArrows} onChange={setEdgeArrows} />
              <ToggleControl label="Curved" checked={curvedEdges} onChange={setCurvedEdges} />
            </section>

            <section className="sigma-controls-group">
              <h3>Labels &amp; Filter</h3>
              <DropdownRow
                label="Node labels"
                ariaLabel="Node labels"
                value={nodeLabels}
                onChange={setNodeLabels}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'selected', label: 'Selected + neighbors' },
                  { value: 'all', label: 'All' },
                  { value: 'none', label: 'None' },
                ]}
              />
              <DropdownRow
                label="Edge labels"
                ariaLabel="Edge labels"
                value={edgeLabels}
                onChange={setEdgeLabels}
                options={[
                  { value: 'selected', label: 'Selected' },
                  { value: 'neighborhood', label: 'Neighborhood' },
                  { value: 'all', label: 'All' },
                  { value: 'none', label: 'None' },
                ]}
              />
              <SliderControl label="Confidence" value={confidence} onChange={setConfidence} />
              <details>
                <summary>Advanced ForceAtlas2</summary>
                <div className="sigma-controls-advanced">
                  <SliderControl label="Scaling" value={scaling} onChange={setScaling} />
                  <ToggleControl label="Barnes-Hut" checked={barnesHut} onChange={setBarnesHut} />
                </div>
              </details>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
