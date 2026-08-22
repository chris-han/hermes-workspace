import { useMemo, useState } from 'react'
import { Line, LineChart, XAxis, YAxis } from 'recharts'

import type {
  TemporalShowcaseAdapterResult,
  TemporalTimelineLane,
} from '../adapters/temporal-showcase-adapter'
import type { ShowcaseGraphModel } from '../semantica-showcase-types'
import { ShowcaseSigmaCanvas } from './shared/showcase-sigma-canvas'
import { computeGraphTopology } from '../../layouts/graph-topology-layouts'

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

const CHART_COLORS = [
  'var(--asimov-visualization-swatch-lime)',
  'var(--asimov-visualization-swatch-cobalt)',
  'var(--asimov-visualization-swatch-tangerine)',
  'var(--asimov-visualization-swatch-periwinkle)',
]

export function TemporalShowcaseView({
  adapter,
  selection,
  onSelect,
}: { adapter: TemporalShowcaseAdapterResult } & TemporalShowcaseSelectionProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto" data-testid="temporal-showcase-view">
      {adapter.kind === 'timeline' ? (
        <TimelineSwimlane adapter={adapter} selection={selection} onSelect={onSelect} />
      ) : null}
      {adapter.kind === 'version-history' ? (
        <VersionsLadder adapter={adapter} selection={selection} onSelect={onSelect} />
      ) : null}
      {adapter.kind === 'temporal-dashboard' ? (
        <DashboardCharts adapter={adapter} selection={selection} onSelect={onSelect} />
      ) : null}
      {adapter.kind === 'network-evolution' ? (
        <EvolutionCanvas adapter={adapter} selection={selection} onSelect={onSelect} />
      ) : null}
    </div>
  )
}

function TimelineSwimlane({
  adapter,
  selection,
  onSelect,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'timeline' }> } & TemporalShowcaseSelectionProps) {
  const lanes: TemporalTimelineLane[] = adapter.lanes
  const laneHeight = 40
  const labelWidth = 128
  const chartWidth = 640
  const pad = 12
  const height = lanes.length * laneHeight + 28
  return (
    <section className="showcase-ref-panel p-3" data-testid="temporal-timeline-visualization">
      <h3 className="font-mono text-sm font-semibold">Timeline</h3>
      <svg
        role="img"
        aria-label="Temporal event timeline grouped by event type"
        data-testid="temporal-timeline-svg"
        width={labelWidth + chartWidth + pad * 2}
        height={height}
        className="mt-2 w-full"
        viewBox={`0 0 ${labelWidth + chartWidth + pad * 2} ${height}`}
      >
        {lanes.map((lane, laneIndex) => {
          const laneY = laneIndex * laneHeight + 20
          return (
            <g key={lane.type} data-testid={`temporal-timeline-lane-${lane.type}`}>
              <text
                x={4}
                y={laneY + 4}
                fill="var(--asimov-muted)"
                fontFamily="monospace"
                fontSize={11}
              >
                {lane.type}
              </text>
              <line
                x1={labelWidth}
                x2={labelWidth + chartWidth + pad}
                y1={laneY}
                y2={laneY}
                stroke="var(--asimov-outline-variant)"
                strokeDasharray="2 4"
              />
              {lane.events.map((event) => {
                const cx = labelWidth + xFor(event.timestamp, adapter.timeBounds, chartWidth, pad)
                const isSelected = selection === event.id
                return (
                  <circle
                    key={event.id}
                    data-testid={`temporal-timeline-item-${event.id}`}
                    cx={cx}
                    cy={laneY}
                    r={isSelected ? 7 : 5}
                    fill={CHART_COLORS[laneIndex % CHART_COLORS.length]}
                    stroke={isSelected ? 'var(--asimov-text)' : 'transparent'}
                    strokeWidth={isSelected ? 2 : 0}
                    role="button"
                    aria-label={`${event.label} · ${event.timestamp}`}
                    onClick={() => onSelect?.(isSelected ? null : event.id)}
                  >
                    <title>{`${event.label} · ${event.timestamp}`}</title>
                  </circle>
                )
              })}
            </g>
          )
        })}
        <text x={labelWidth + pad} y={height - 6} fontSize={10} fill="var(--asimov-muted)" fontFamily="monospace">
          {adapter.timeBounds.start}
        </text>
        <text
          x={labelWidth + chartWidth + pad}
          y={height - 6}
          fontSize={10}
          textAnchor="end"
          fill="var(--asimov-muted)"
          fontFamily="monospace"
        >
          {adapter.timeBounds.end}
        </text>
      </svg>
    </section>
  )
}

function VersionsLadder({
  adapter,
  selection,
  onSelect,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'version-history' }> } & TemporalShowcaseSelectionProps) {
  const width = 720
  const pad = 60
  const rungY = 56
  const points = adapter.versions.map((version) => ({
    version,
    x: pad + xFor(version.timestamp, adapter.timeBounds, width - pad * 2, 0),
  }))
  const connectorPath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${rungY}`)
    .join(' ')
  return (
    <section className="showcase-ref-panel p-3" data-testid="temporal-versions-visualization">
      <h3 className="font-mono text-sm font-semibold">Version History</h3>
      <svg
        role="img"
        aria-label="Chronological connected version ladder"
        data-testid="temporal-versions-ladder"
        width={width}
        height={120}
        className="mt-2 w-full"
        viewBox={`0 0 ${width} 120`}
      >
        {points.length > 1 ? (
          <path
            data-testid="temporal-versions-connector"
            d={connectorPath}
            fill="none"
            stroke="var(--asimov-outline)"
            strokeWidth={1.5}
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
              onClick={() => onSelect?.(isSelected ? null : version.id)}
            >
              <circle
                cx={x}
                cy={rungY}
                r={isSelected ? 9 : 7}
                fill={isSelected ? 'var(--asimov-brand)' : 'var(--asimov-panel)'}
                stroke="var(--asimov-brand)"
                strokeWidth={2}
              />
              <text x={x} y={rungY - 18} fontSize={11} textAnchor="middle" fill="var(--asimov-text)" fontFamily="monospace">
                {version.id}
              </text>
              <text x={x} y={rungY + 30} fontSize={10} textAnchor="middle" fill="var(--asimov-muted)" fontFamily="monospace">
                {version.timestamp}
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}

function DashboardCharts({
  adapter,
  selection,
  onSelect,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'temporal-dashboard' }> } & TemporalShowcaseSelectionProps) {
  const bounds = useMemo(() => {
    const starts = adapter.lifelines.map((lifeline) => lifeline.start)
    const ends = adapter.lifelines.map((lifeline) => lifeline.end)
    return {
      start: starts.sort()[0] ?? '',
      end: ends.sort()[ends.length - 1] ?? '',
    }
  }, [adapter.lifelines])
  const labelWidth = 128
  const chartWidth = 560
  const pad = 12
  const rowHeight = 26
  const lifelineHeight = adapter.lifelines.length * rowHeight + 24
  const axisTicks = adapter.activity.map((point) => point.timestamp)
  const sharedXAxisProps = {
    dataKey: 'timestamp',
    tick: { fontSize: 10 },
    interval: Math.max(0, Math.floor(axisTicks.length / 6) - 1),
  } as const
  return (
    <section className="showcase-ref-panel p-3" data-testid="temporal-dashboard-visualization">
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
            const rowY = index * rowHeight + 12
            const startX = labelWidth + xFor(lifeline.start, bounds, chartWidth, pad)
            const endX = labelWidth + xFor(lifeline.end, bounds, chartWidth, pad)
            const isSelected = selection === lifeline.id
            return (
              <g
                key={lifeline.id}
                data-testid={`temporal-dashboard-lifeline-${lifeline.id}`}
                role="button"
                aria-label={`${lifeline.label} · ${lifeline.start} → ${lifeline.end}`}
                onClick={() => onSelect?.(isSelected ? null : lifeline.id)}
              >
                <text x={4} y={rowY + 6} fontSize={10} fill="var(--asimov-muted)" fontFamily="monospace">
                  {lifeline.label}
                </text>
                <rect
                  x={startX}
                  y={rowY - 2}
                  width={Math.max(2, endX - startX)}
                  height={8}
                  rx={2}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  opacity={isSelected ? 1 : 0.75}
                  stroke={isSelected ? 'var(--asimov-text)' : 'none'}
                />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-3" data-testid="temporal-dashboard-activity">
        <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Network activity over time</div>
        <LineChart width={720} height={180} data={adapter.activity} className="w-full">
          <XAxis {...sharedXAxisProps} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
          <Line
            type="monotone"
            dataKey="activeEntities"
            name="Active Entities"
            stroke={CHART_COLORS[0]}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="activeRelationships"
            name="Active Relationships"
            stroke={CHART_COLORS[1]}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </div>

      <div className="mt-3" data-testid="temporal-dashboard-metrics">
        <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">Metrics evolution</div>
        <LineChart
          width={720}
          height={180}
          data={(adapter.metricsSeries?.[0]?.values ?? []).map((point) => ({ timestamp: point.timestamp }))}
          className="w-full"
        >
          <XAxis {...sharedXAxisProps} />
          <YAxis tick={{ fontSize: 10 }} width={48} />
          {(adapter.metricsSeries ?? []).map((series, index) => (
            <Line
              key={series.label}
              type="monotone"
              dataKey="value"
              name={series.label}
              data={series.values}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </div>
    </section>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <section className="showcase-ref-panel flex min-h-0 flex-1 flex-col p-3" data-testid="temporal-evolution-visualization">
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
    </section>
  )
}
