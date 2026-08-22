import { useMemo, useState } from 'react'
import { Line, LineChart, XAxis, YAxis } from 'recharts'

import type {
  TemporalShowcaseAdapterResult,
  TemporalTimelineLane,
} from '../adapters/temporal-showcase-adapter'
import type { ShowcaseGraphModel } from '../semantica-showcase-types'
import { computeGraphTopology } from '../../layouts/graph-topology-layouts'
import {
  asimovLaneBaselineY,
  asimovLaneBlockHeight,
  snapSizeToAsimovGrid,
  snapToAsimovGrid,
} from '../visualization/asimov-visualization-spatial'
import { ASIMOV_VISUALIZATION_THEME } from '../visualization/asimov-visualization-theme'
import {
  DEFAULT_VISUALIZATION_CONTROL_STATE
  
} from '../visualization/visualization-control-state'
import type {VisualizationControlState} from '../visualization/visualization-control-state';
import { VisualizationShell } from '../visualization/visualization-shell'
import { ChartVisualizationFooter, VisualizationFooter } from '../visualization/visualization-footer'
import {
  
  asimovSeriesColor,
  compileAsimovChartConfig
} from '../visualization/recharts-svg/asimov-chart-compiler'
import type {AsimovChartConfig} from '../visualization/recharts-svg/asimov-chart-compiler';
import { ShowcaseSigmaCanvas } from './shared/showcase-sigma-canvas'

/**
 * Temporal showcase visual encodings (plan
 * `2026-08-22-semantica-renderer-visual-parity-remediation-v1`).
 *
 * Timeline decision: the plan's preferred library was `vis-timeline` grouped
 * by event type. It was rejected in favor of the documented SVG swimlane
 * fallback because (1) vis-timeline requires measurable DOM geometry and does
 * not materialize `.vis-item` nodes under jsdom, which makes the plan's
 * mandatory renderer/DOM test layer non-deterministic, and (2) its default
 * light theme would need a large override surface to satisfy the Asimov
 * dark/light contract. The SVG swimlane implements the same normative mapping
 * (lane per event.type, x = event.timestamp, point markers, source event IDs
 * as item IDs) with full offline determinism.
 *
 * Theme/spatial migration (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, W4/W5 on
 * the documented §7.1 Recharts/SVG fallback): every presentation literal
 * (lane baselines, paddings, viewport sizes, fonts, colors) derives from the
 * canonical `ASIMOV_VISUALIZATION_THEME` + 24px lattice tokens via
 * `compileAsimovChartConfig`. Mark X positions remain data-driven (A1) and
 * every submode mounts through the shared VisualizationShell/Footer (A8).
 */

export interface TemporalShowcaseSelectionProps {
  selection?: string | null
  onSelect?: (selection: string | null) => void
}

function timestampValue(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : 0
}

function xFor(timestamp: string, bounds: { start: string; end: string }, width: number, pad: number): number {
  const min = timestampValue(bounds.start)
  const max = timestampValue(bounds.end)
  if (max <= min) return pad + width / 2
  return pad + ((timestampValue(timestamp) - min) / (max - min)) * width
}

/**
 * Deterministic chart viewport transform: scale a data x position around the
 * chart center by the control-state zoom factor (1 = full extent; FIT resets
 * to 1). Marks outside the viewport clip against the SVG bounds.
 */
function zoomAround(value: number, center: number, zoom: number): number {
  return center + (value - center) * zoom
}

/** Centered visible-row window for Recharts panels (zoom 1 = all rows). */
function windowRows<T>(rows: readonly T[], zoom: number): T[] {
  if (zoom <= 1 || rows.length <= 1) return [...rows]
  const count = Math.max(1, Math.ceil(rows.length / zoom))
  const start = Math.floor((rows.length - count) / 2)
  return rows.slice(start, start + count)
}

const THEME = ASIMOV_VISUALIZATION_THEME

export function TemporalShowcaseView({
  adapter,
  selection,
  onSelect,
}: { adapter: TemporalShowcaseAdapterResult } & TemporalShowcaseSelectionProps) {
  // Renderer-neutral control state for the chart-native submodes (W6,
  // UI-scoped; the AI path is deferred per plan §9.3/W6-04).
  const [controls, setControls] = useState<VisualizationControlState>(DEFAULT_VISUALIZATION_CONTROL_STATE)
  const chartConfig = useMemo(() => compileAsimovChartConfig(controls), [controls])
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto" data-testid="temporal-showcase-view">
      {adapter.kind === 'timeline' ? (
        <TimelineSwimlane
          adapter={adapter}
          selection={selection}
          onSelect={onSelect}
          config={chartConfig}
          controls={controls}
          onControlsChange={setControls}
        />
      ) : null}
      {adapter.kind === 'version-history' ? (
        <VersionsLadder
          adapter={adapter}
          selection={selection}
          onSelect={onSelect}
          config={chartConfig}
          controls={controls}
          onControlsChange={setControls}
        />
      ) : null}
      {adapter.kind === 'temporal-dashboard' ? (
        <DashboardCharts
          adapter={adapter}
          selection={selection}
          onSelect={onSelect}
          config={chartConfig}
          controls={controls}
          onControlsChange={setControls}
        />
      ) : null}
      {adapter.kind === 'network-evolution' ? (
        <EvolutionCanvas adapter={adapter} selection={selection} onSelect={onSelect} />
      ) : null}
    </div>
  )
}

interface ChartViewProps {
  config: AsimovChartConfig
  controls: VisualizationControlState
  onControlsChange: (next: VisualizationControlState) => void
}

function ChartFooter({
  rendererTag,
  summary,
  controls,
  onControlsChange,
}: {
  rendererTag: string
  summary: string
  controls: VisualizationControlState
  onControlsChange: (next: VisualizationControlState) => void
}) {
  // Sigma-footer parity (MODE / ZOOM / FIT + gear) lives in the shared
  // ChartVisualizationFooter; chart views only supply tag/summary text.
  return (
    <ChartVisualizationFooter
      rendererTag={rendererTag}
      summary={summary}
      controls={controls}
      onControlsChange={onControlsChange}
    />
  )
}

function TimelineSwimlane({
  adapter,
  selection,
  onSelect,
  config,
  controls,
  onControlsChange,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'timeline' }> } & TemporalShowcaseSelectionProps & ChartViewProps) {
  const lanes: TemporalTimelineLane[] = adapter.lanes
  const spatial = config.geometry
  // Presentation geometry snaps to the 24px lattice; event X positions are
  // data-driven through `xFor` and never snapped (A1).
  const labelWidth = snapSizeToAsimovGrid(128)
  const chartWidth = snapSizeToAsimovGrid(640)
  const pad = spatial.viewportPaddingX
  const height = asimovLaneBlockHeight(lanes.length, spatial)
  const width = snapToAsimovGrid(labelWidth + chartWidth + pad * 2)
  const zoom = config.interaction.zoomFactor
  const centerX = labelWidth + pad + chartWidth / 2
  const selectEnabled = config.interaction.select
  return (
    <VisualizationShell testId="temporal-timeline-visualization" ariaLabel="Timeline visualization">
      <div className="p-3">
        <h3 className="font-mono text-sm font-semibold">Timeline</h3>
        <svg
          role="img"
          aria-label="Temporal event timeline grouped by event type"
          data-testid="temporal-timeline-svg"
          width={width}
          height={height}
          className="mt-2 w-full"
          viewBox={`0 0 ${width} ${height}`}
        >
          {lanes.map((lane, laneIndex) => {
            const laneY = asimovLaneBaselineY(laneIndex, spatial)
            return (
              <g key={lane.type} data-testid={`temporal-timeline-lane-${lane.type}`}>
                {config.axis.labels ? (
                  <text
                    x={4}
                    y={laneY + 4}
                    fill={config.colors.textMuted}
                    fontFamily={config.fonts.value}
                    fontSize={11}
                  >
                    {lane.type}
                  </text>
                ) : null}
                {config.axis.guides ? (
                  <line
                    x1={labelWidth}
                    x2={labelWidth + chartWidth + pad}
                    y1={laneY}
                    y2={laneY}
                    stroke={config.guide.stroke}
                    strokeDasharray={config.guide.strokeDasharray}
                    opacity={config.guide.opacity}
                  />
                ) : null}
                {lane.events.map((event) => {
                  const cx = zoomAround(labelWidth + xFor(event.timestamp, adapter.timeBounds, chartWidth, pad), centerX, zoom)
                  const isSelected = selection === event.id
                  return (
                    <circle
                      key={event.id}
                      data-testid={`temporal-timeline-item-${event.id}`}
                      cx={cx}
                      cy={laneY}
                      r={isSelected ? config.mark.size + 2 : config.mark.size}
                      fill={asimovSeriesColor(laneIndex)}
                      opacity={config.mark.opacity}
                      stroke={isSelected ? config.colors.text : 'transparent'}
                      strokeWidth={isSelected ? config.mark.strokeWidth : 0}
                      role="button"
                      aria-label={`${event.label} · ${event.timestamp}`}
                      onClick={selectEnabled ? () => onSelect?.(isSelected ? null : event.id) : undefined}
                    >
                      <title>{`${event.label} · ${event.timestamp}`}</title>
                    </circle>
                  )
                })}
              </g>
            )
          })}
          {config.axis.visibleX ? (
            <>
              <text x={labelWidth + pad} y={height - 6} fontSize={10} fill={config.colors.textMuted} fontFamily={config.fonts.value}>
                {adapter.timeBounds.start}
              </text>
              <text
                x={labelWidth + chartWidth + pad}
                y={height - 6}
                fontSize={10}
                textAnchor="end"
                fill={config.colors.textMuted}
                fontFamily={config.fonts.value}
              >
                {adapter.timeBounds.end}
              </text>
            </>
          ) : null}
        </svg>
      </div>
      <ChartFooter
        rendererTag="SVG"
        summary={`Timeline · ${lanes.length} lanes · ${adapter.events.length} events`}
        controls={controls}
        onControlsChange={onControlsChange}
      />
    </VisualizationShell>
  )
}

function VersionsLadder({
  adapter,
  selection,
  onSelect,
  config,
  controls,
  onControlsChange,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'version-history' }> } & TemporalShowcaseSelectionProps & ChartViewProps) {
  const spatial = config.geometry
  const width = snapToAsimovGrid(720)
  const pad = spatial.viewportPaddingX * 3
  const rungY = snapToAsimovGrid(56)
  const height = snapSizeToAsimovGrid(120)
  const points = adapter.versions.map((version) => ({
    version,
    x: zoomAround(
      pad + xFor(version.timestamp, adapter.timeBounds, width - pad * 2, 0),
      width / 2,
      config.interaction.zoomFactor,
    ),
  }))
  const selectEnabled = config.interaction.select
  const connectorPath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${rungY}`)
    .join(' ')
  return (
    <VisualizationShell testId="temporal-versions-visualization" ariaLabel="Version history visualization">
      <div className="p-3">
        <h3 className="font-mono text-sm font-semibold">Version History</h3>
        <svg
          role="img"
          aria-label="Chronological connected version ladder"
          data-testid="temporal-versions-ladder"
          width={width}
          height={height}
          className="mt-2 w-full"
          viewBox={`0 0 ${width} ${height}`}
        >
          {points.length > 1 ? (
            <path
              data-testid="temporal-versions-connector"
              d={connectorPath}
              fill="none"
              stroke={config.guide.stroke}
              strokeWidth={config.mark.strokeWidth}
            />
          ) : (
            <path data-testid="temporal-versions-connector" d="" fill="none" />
          )}
          {points.map(({ version, x }) => {
            const isSelected = selection === version.id
            return (
              <g
                key={version.id}
                data-testid={`temporal-version-rung-${version.id}`}
                role="button"
                aria-label={`${version.label} · ${version.timestamp}`}
                onClick={selectEnabled ? () => onSelect?.(isSelected ? null : version.id) : undefined}
              >
                <circle
                  cx={x}
                  cy={rungY}
                  r={isSelected ? config.mark.size + 4 : config.mark.size + 2}
                  fill={isSelected ? THEME.semantic.focus : 'var(--asimov-panel)'}
                  stroke={THEME.semantic.focus}
                  strokeWidth={config.mark.strokeWidth}
                />
                {config.axis.labels ? (
                  <>
                    <text x={x} y={rungY - 18} fontSize={11} textAnchor="middle" fill={config.colors.text} fontFamily={config.fonts.value}>
                      {version.id}
                    </text>
                    <text x={x} y={rungY + 30} fontSize={10} textAnchor="middle" fill={config.colors.textMuted} fontFamily={config.fonts.value}>
                      {version.timestamp}
                    </text>
                  </>
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
      <ChartFooter
        rendererTag="SVG"
        summary={`Versions · ${adapter.versions.length} rungs`}
        controls={controls}
        onControlsChange={onControlsChange}
      />
    </VisualizationShell>
  )
}

function DashboardCharts({
  adapter,
  selection,
  onSelect,
  config,
  controls,
  onControlsChange,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'temporal-dashboard' }> } & TemporalShowcaseSelectionProps & ChartViewProps) {
  const bounds = useMemo(() => {
    const starts = adapter.lifelines.map((lifeline) => lifeline.start)
    const ends = adapter.lifelines.map((lifeline) => lifeline.end)
    return {
      start: starts.sort()[0] ?? '',
      end: ends.sort()[ends.length - 1] ?? '',
    }
  }, [adapter.lifelines])
  const spatial = config.geometry
  const labelWidth = snapSizeToAsimovGrid(128)
  const chartWidth = snapSizeToAsimovGrid(560)
  const pad = spatial.viewportPaddingX
  const zoom = config.interaction.zoomFactor
  const centerX = labelWidth + pad + chartWidth / 2
  const selectEnabled = config.interaction.select
  const rowHeight = spatial.laneStep / 2
  const lifelineHeight = snapSizeToAsimovGrid(adapter.lifelines.length * rowHeight + spatial.viewportPaddingY)
  const panelHeight = snapSizeToAsimovGrid(180)
  // Recharts panels zoom by narrowing the visible x-domain window (centered,
  // deterministic); zoom 1 keeps the full data extent.
  const activityRows = windowRows(adapter.activity, zoom)
  const axisTicks = activityRows.map((point) => point.timestamp)
  const sharedXAxisProps = {
    dataKey: 'timestamp',
    tick: config.axis.tick,
    interval: Math.max(0, Math.floor(axisTicks.length / 6) - 1),
    hide: !config.axis.visibleX,
  } as const
  return (
    <VisualizationShell testId="temporal-dashboard-visualization" ariaLabel="Temporal dashboard visualization">
      <div className="p-3">
        <h3 className="font-mono text-sm font-semibold">Dashboard</h3>

        <div className="mt-2" data-testid="temporal-dashboard-lifelines">
          <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Entity lifecycles</div>
          <svg
            role="img"
            aria-label="Entity lifecycle lifelines"
            width={labelWidth + chartWidth + pad * 2}
            height={lifelineHeight}
            className="w-full"
            viewBox={`0 0 ${labelWidth + chartWidth + pad * 2} ${lifelineHeight}`}
          >
            {adapter.lifelines.map((lifeline, index) => {
              const rowY = spatial.labelOffset + index * rowHeight
              const startX = zoomAround(labelWidth + xFor(lifeline.start, bounds, chartWidth, pad), centerX, zoom)
              const endX = zoomAround(labelWidth + xFor(lifeline.end, bounds, chartWidth, pad), centerX, zoom)
              const isSelected = selection === lifeline.id
              return (
                <g
                  key={lifeline.id}
                  data-testid={`temporal-dashboard-lifeline-${lifeline.id}`}
                  role="button"
                  aria-label={`${lifeline.label} · ${lifeline.start} → ${lifeline.end}`}
                  onClick={selectEnabled ? () => onSelect?.(isSelected ? null : lifeline.id) : undefined}
                >
                  {config.axis.labels ? (
                    <text x={4} y={rowY + 6} fontSize={10} fill={config.colors.textMuted} fontFamily={config.fonts.value}>
                      {lifeline.label}
                    </text>
                  ) : null}
                  <rect
                    x={startX}
                    y={rowY - 2}
                    width={Math.max(2, endX - startX)}
                    height={8}
                    rx={2}
                    fill={asimovSeriesColor(index)}
                    opacity={isSelected ? 1 : config.mark.opacity * 0.83}
                    stroke={isSelected ? config.colors.text : 'none'}
                  />
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-3" data-testid="temporal-dashboard-activity">
          <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Network activity over time</div>
          <LineChart width={snapToAsimovGrid(720)} height={panelHeight} data={activityRows} className="w-full">
            <XAxis {...sharedXAxisProps} />
            <YAxis allowDecimals={false} tick={config.axis.tick} width={48} hide={!config.axis.visibleY} />
            <Line
              type="monotone"
              dataKey="activeEntities"
              name="Active Entities"
              stroke={asimovSeriesColor(0)}
              strokeWidth={config.mark.strokeWidth}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="activeRelationships"
              name="Active Relationships"
              stroke={asimovSeriesColor(1)}
              strokeWidth={config.mark.strokeWidth}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </div>

        <div className="mt-3" data-testid="temporal-dashboard-metrics">
          <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Metrics evolution</div>
          <LineChart
            width={snapToAsimovGrid(720)}
            height={panelHeight}
            data={windowRows(adapter.metricsSeries?.[0]?.values ?? [], zoom).map((point) => ({ timestamp: point.timestamp }))}
            className="w-full"
          >
            <XAxis {...sharedXAxisProps} />
            <YAxis tick={config.axis.tick} width={48} hide={!config.axis.visibleY} />
            {(adapter.metricsSeries ?? []).map((series, index) => (
              <Line
                key={series.label}
                type="monotone"
                dataKey="value"
                name={series.label}
                data={windowRows(series.values, zoom)}
                stroke={asimovSeriesColor(index)}
                strokeWidth={config.mark.strokeWidth}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </div>
      </div>
      <ChartFooter
        rendererTag="RECHARTS · SVG"
        summary={`Dashboard · 3 panels · ${adapter.metricsSeries?.length ?? 0} series`}
        controls={controls}
        onControlsChange={onControlsChange}
      />
    </VisualizationShell>
  )
}

function EvolutionCanvas({
  adapter,
  selection,
  onSelect,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'network-evolution' }> } & TemporalShowcaseSelectionProps) {
  const [frameIndex, setFrameIndex] = useState(0)
  const frameTime = adapter.frameTimes[Math.min(frameIndex, adapter.frameTimes.length - 1)] ?? ''

  // R2: ONE global deterministic layout computed once over the complete
  // evolution graph. The memo depends on the graph only — changing the frame
  // slider (frameTime) never recomputes positions.
  const positions = useMemo(() => {
    const topology = computeGraphTopology(
      {
        nodes: adapter.graph.nodes.map((node) => ({ id: node.id, label: node.label, group: node.group })),
        edges: adapter.graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
      },
      'layout',
      { seed: 'temporal-evolution' },
    )
    return Object.fromEntries(Array.from(topology.positions.entries()))
  }, [adapter.graph])

  const membership = adapter.frameMembership[frameTime] ?? { nodeIds: [], edgeIds: [] }
  const frameModel: ShowcaseGraphModel = useMemo(() => {
    const nodeIds = new Set(membership.nodeIds)
    const edgeIds = new Set(membership.edgeIds)
    return {
      nodes: adapter.graph.nodes.filter((node) => nodeIds.has(node.id)),
      edges: adapter.graph.edges.filter((edge) => edgeIds.has(edge.id)),
    }
     
  }, [adapter.graph, frameTime])

  const handleFrameChange = (nextIndex: number) => {
    setFrameIndex(nextIndex)
    // R8: a selection that is absent in the new frame is invalidated.
    const nextFrameTime = adapter.frameTimes[nextIndex]
    if (selection && nextFrameTime) {
      const nextMembership = adapter.frameMembership[nextFrameTime]
      if (nextMembership && !nextMembership.nodeIds.includes(selection)) {
        onSelect?.(null)
      }
    }
  }

  return (
    <VisualizationShell
      testId="temporal-evolution-visualization"
      ariaLabel="Network evolution visualization"
      className="min-h-0 flex-1"
    >
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <h3 className="font-mono text-sm font-semibold">Network Evolution</h3>
        <div className="flex min-h-[360px] flex-1">
          <ShowcaseSigmaCanvas
            model={frameModel}
            positions={positions}
            selection={selection ? { type: 'node', id: selection } : null}
            ariaLabel="Temporal network evolution canvas"
            onSelect={(next) => onSelect?.(next?.type === 'node' ? next.id : null)}
          />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            data-testid="temporal-evolution-slider"
            aria-label="Evolution frame"
            min={0}
            max={Math.max(0, adapter.frameTimes.length - 1)}
            step={1}
            value={frameIndex}
            onChange={(event) => handleFrameChange(Number(event.target.value))}
            className="w-full"
          />
          <span className="font-mono text-xs text-muted-foreground" data-testid="temporal-evolution-frame-label">
            {frameTime}
          </span>
        </div>
      </div>
      <VisualizationFooter
        rendererTag="SIGMA · WEBGL"
        summary={`Evolution · frame ${Math.min(frameIndex, adapter.frameTimes.length - 1) + 1}/${adapter.frameTimes.length}`}
      />
    </VisualizationShell>
  )
}
