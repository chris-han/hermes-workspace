/**
 * Asimov Vega-Lite chart compiler (plan
 * `2026-08-22-semantica-vega-lite-chart-engine-v1`, T2/T3).
 *
 * Vega-Lite is the showcase chart engine (the parent plan's §7.1/W0 Decision 2
 * Recharts/SVG fallback is amended by that plan's successor): every chart
 * view compiles a renderer-neutral semantic model +
 * `VisualizationControlState` + `AsimovVisualizationTheme_v1` into a
 * DETERMINISTIC Vega-Lite spec (A12). Same inputs always compile to a
 * deeply-equal spec. Views must not restyle compiled specs (§7.2).
 *
 * Vega native interactivity is compiled declaratively:
 *   - tooltips on every mark (semantic fields only);
 *   - `hover` point param drives a highlight condition;
 *   - `pick` point param (fields: ['id']) is present only when
 *     `interaction.mode === 'select'` (View = hover only); views read the
 *     `pick` signal via react-vega signal listeners and route it to the
 *     existing selection flow;
 *   - `grid` interval param bound to scales enables Vega-native pan/zoom
 *     when `interaction.zoom`/`interaction.pan` are on. The footer ZOOM/FIT
 *     factor compiles to a centered initial x-domain window (FIT = 1).
 *
 * Colors come ONLY from the canonical Asimov swatch mirror
 * (`seriesValues`, A4); semantic status colors stay semantic (A5).
 */

import type { VisualizationControlState } from '../visualization-control-state'
import { ASIMOV_VISUALIZATION_THEME } from '../asimov-visualization-theme'
import type { AsimovVisualizationTheme } from '../asimov-visualization-theme'

export interface AsimovVegaCompileInput {
  controls: VisualizationControlState
  theme?: AsimovVisualizationTheme
}

type PlainSpec = Record<string, unknown>

function timestampValue(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Centered initial x-domain window for the footer ZOOM factor (FIT = 1 keeps
 * the full data extent). Data geometry stays continuous (A1); only the
 * initial viewport domain narrows.
 */
function zoomedDomain(start: string, end: string, zoom: number): [string, string] | null {
  if (zoom <= 1) return null
  const min = timestampValue(start)
  const max = timestampValue(end)
  if (max <= min) return null
  const span = (max - min) / zoom
  const center = (min + max) / 2
  return [new Date(center - span / 2).toISOString(), new Date(center + span / 2).toISOString()]
}

/** Vega-Lite interaction params compiled from the control state. */
export function asimovVegaParams(controls: VisualizationControlState): PlainSpec[] {
  const params: PlainSpec[] = [
    {
      name: 'hover',
      select: { type: 'point', on: 'pointerover', clear: 'pointerout' },
    },
  ]
  if (controls.interaction.mode === 'select') {
    params.push({
      name: 'pick',
      select: { type: 'point', fields: ['id'], on: 'click', clear: 'dblclick' },
    })
  }
  if (controls.interaction.zoom || controls.interaction.pan) {
    params.push({
      name: 'grid',
      select: { type: 'interval', encodings: ['x'] },
      bind: 'scales',
    })
  }
  return params
}

/** Shared Vega-Lite `config` block compiled from the canonical theme. */
export function asimovVegaConfig(input: AsimovVegaCompileInput): PlainSpec {
  const theme = input.theme ?? ASIMOV_VISUALIZATION_THEME
  const { controls } = input
  return {
    background: 'transparent',
    font: theme.typography.valueFont,
    axis: {
      labelFont: theme.typography.valueFont,
      titleFont: theme.typography.labelFont,
      labelFontSize: 10,
      labelColor: theme.surfaces.textMuted,
      tickColor: theme.surfaces.textMuted,
      domainColor: theme.surfaces.textMuted,
      gridColor: 'var(--asimov-outline-variant)',
      gridOpacity: theme.marks.guideOpacity,
      grid: controls.axes.guides,
      labels: controls.axes.labels,
    },
    axisX: { hidden: !controls.axes.x },
    axisY: { hidden: !controls.axes.y },
    view: { stroke: null },
    mark: {
      opacity: controls.mark.opacity / 100,
      strokeWidth: controls.mark.strokeWidth,
    },
    range: { category: [...theme.seriesValues] },
  }
}

/** Hover/selection highlight encoding shared by all chart marks. */
function highlightEncoding(controls: VisualizationControlState): PlainSpec {
  const base = controls.mark.opacity / 100
  return {
    opacity: {
      condition: [
        { param: 'hover', empty: false, value: 1 },
        ...(controls.interaction.mode === 'select'
          ? [{ param: 'pick', empty: true, value: 1 }]
          : []),
      ],
      value: base,
    },
  }
}

interface TimelineEventLike {
  id: string
  timestamp: string
  label: string
}
interface TimelineLaneLike {
  type: string
  events: TimelineEventLike[]
}

export interface GanttRow {
  id: string
  label: string
  lane: string
  start: string
  end: string
}

/**
 * Gantt derivation (documented in the plan): timeline events are
 * point-in-time, so each bar spans its timestamp to the NEXT event in the
 * same lane; a lane's last event gets a tail equal to the lane's median
 * intra-event gap (fallback: 1 day when a lane has a single event). Purely
 * presentational — adapter semantics are unchanged.
 */
export function deriveGanttRows(lanes: readonly TimelineLaneLike[]): GanttRow[] {
  const rows: GanttRow[] = []
  for (const lane of lanes) {
    const events = [...lane.events].sort((left, right) => {
      if (left.timestamp !== right.timestamp) return left.timestamp.localeCompare(right.timestamp)
      return left.id.localeCompare(right.id)
    })
    const gaps: number[] = []
    for (let index = 1; index < events.length; index += 1) {
      gaps.push(timestampValue(events[index].timestamp) - timestampValue(events[index - 1].timestamp))
    }
    gaps.sort((a, b) => a - b)
    const medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 86_400_000
    events.forEach((event, index) => {
      const start = timestampValue(event.timestamp)
      const end =
        index + 1 < events.length ? timestampValue(events[index + 1].timestamp) : start + medianGap
      rows.push({
        id: event.id,
        label: event.label,
        lane: lane.type,
        start: new Date(start).toISOString(),
        end: new Date(Math.max(end, start)).toISOString(),
      })
    })
  }
  return rows
}

/** Timeline replacement: Gantt chart (bar x=start → x2=end, y=lane). */
export function buildGanttTimelineSpec(
  lanes: readonly TimelineLaneLike[],
  timeBounds: { start: string; end: string },
  input: AsimovVegaCompileInput,
): PlainSpec {
  const theme = input.theme ?? ASIMOV_VISUALIZATION_THEME
  const { controls } = input
  const rows = deriveGanttRows(lanes)
  const domain = zoomedDomain(timeBounds.start, timeBounds.end, controls.interaction.zoomFactor)
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 'container',
    autosize: { type: 'fit-x', resize: true },
    height: Math.max(theme.geometry.laneStep * Math.max(1, lanes.length), theme.geometry.laneStep * 2),
    data: { values: rows },
    params: asimovVegaParams(controls),
    mark: { type: 'bar', tooltip: true, aria: true, height: { band: 0.6 }, cornerRadiusEnd: 2 },
    encoding: {
      x: {
        field: 'start',
        type: 'temporal',
        title: null,
        scale: domain ? { domain } : {},
      },
      x2: { field: 'end' },
      y: {
        field: 'lane',
        type: 'nominal',
        title: null,
        sort: lanes.map((lane) => lane.type),
      },
      color: { field: 'lane', type: 'nominal', legend: null },
      tooltip: [
        { field: 'id' },
        { field: 'label' },
        { field: 'lane' },
        { field: 'start', type: 'temporal' },
        { field: 'end', type: 'temporal' },
      ],
      ...highlightEncoding(controls),
    },
    config: asimovVegaConfig(input),
  }
}

interface VersionLike {
  id: string
  timestamp: string
  label: string
}

/** Versions: connected chronological ladder (line + point marks, single rung). */
export function buildVersionLadderSpec(
  versions: readonly VersionLike[],
  timeBounds: { start: string; end: string },
  input: AsimovVegaCompileInput,
): PlainSpec {
  const theme = input.theme ?? ASIMOV_VISUALIZATION_THEME
  const { controls } = input
  const ordered = [...versions].sort((left, right) => {
    if (left.timestamp !== right.timestamp) return left.timestamp.localeCompare(right.timestamp)
    return left.id.localeCompare(right.id)
  })
  const rows = ordered.map((version, index) => ({
    id: version.id,
    label: version.label,
    timestamp: version.timestamp,
    order: index,
    rung: 0,
  }))
  const domain = zoomedDomain(timeBounds.start, timeBounds.end, controls.interaction.zoomFactor)
  const xEncoding: PlainSpec = {
    field: 'timestamp',
    type: 'temporal',
    title: null,
    scale: domain ? { domain } : {},
  }
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 'container',
    autosize: { type: 'fit-x', resize: true },
    height: theme.geometry.laneStep * 5,
    layer: [
      {
        data: { values: rows },
        mark: { type: 'line', strokeWidth: controls.mark.strokeWidth, color: theme.seriesValues[0] },
        encoding: {
          x: xEncoding,
          y: { field: 'rung', type: 'quantitative', axis: null, scale: { domain: [-1, 1] } },
        },
      },
      {
        data: { values: rows },
        params: asimovVegaParams(controls),
        mark: { type: 'point', tooltip: true, aria: true, filled: true, size: controls.mark.size * 20 },
        encoding: {
          x: xEncoding,
          y: { field: 'rung', type: 'quantitative', axis: null, scale: { domain: [-1, 1] } },
          color: { value: theme.seriesValues[0] },
          tooltip: [{ field: 'id' }, { field: 'label' }, { field: 'timestamp', type: 'temporal' }],
          ...highlightEncoding(controls),
        },
      },
    ],
    config: asimovVegaConfig(input),
  }
}

interface LifelineLike {
  id: string
  label: string
  start: string
  end: string
}
interface ActivityPointLike {
  timestamp: string
  activeEntities: number
  activeRelationships: number
}
interface MetricsSeriesLike {
  label: string
  values: Array<{ timestamp: string; value: number }>
}

/** Temporal dashboard: vconcat of lifelines Gantt + activity + metrics. */
export function buildTemporalDashboardSpec(
  model: {
    lifelines: readonly LifelineLike[]
    activity: readonly ActivityPointLike[]
    metricsSeries: readonly MetricsSeriesLike[]
    timeBounds: { start: string; end: string }
  },
  input: AsimovVegaCompileInput,
): PlainSpec {
  const theme = input.theme ?? ASIMOV_VISUALIZATION_THEME
  const { controls } = input
  const domain = zoomedDomain(
    model.timeBounds.start,
    model.timeBounds.end,
    controls.interaction.zoomFactor,
  )
  const xScale: PlainSpec = domain ? { domain } : {}
  const panelHeight = theme.geometry.laneStep * 4
  const activityRows = model.activity.flatMap((point) => [
    { series: 'Active Entities', timestamp: point.timestamp, value: point.activeEntities },
    { series: 'Active Relationships', timestamp: point.timestamp, value: point.activeRelationships },
  ])
  const metricsRows = model.metricsSeries.flatMap((series) =>
    series.values.map((point) => ({
      series: series.label,
      timestamp: point.timestamp,
      value: point.value,
    })),
  )
  const lineLayer = (rows: PlainSpec[], yTitle: string): PlainSpec => ({
    width: 'container',
    height: panelHeight,
    data: { values: rows },
    mark: { type: 'line', tooltip: true, aria: true, point: false },
    encoding: {
      x: { field: 'timestamp', type: 'temporal', title: null, scale: xScale },
      y: { field: 'value', type: 'quantitative', title: yTitle },
      color: { field: 'series', type: 'nominal', legend: null },
      strokeWidth: { value: controls.mark.strokeWidth },
    },
  })
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    vconcat: [
      {
        width: 'container',
        autosize: { type: 'fit-x', resize: true },
        height: Math.max(theme.geometry.laneStep * Math.max(1, model.lifelines.length), panelHeight),
        data: {
          values: model.lifelines.map((lifeline) => ({
            id: lifeline.id,
            label: lifeline.label,
            start: lifeline.start,
            end: lifeline.end,
          })),
        },
        params: asimovVegaParams(controls),
        mark: { type: 'bar', tooltip: true, aria: true, height: { band: 0.55 }, cornerRadiusEnd: 2 },
        encoding: {
          x: { field: 'start', type: 'temporal', title: null, scale: xScale },
          x2: { field: 'end' },
          y: {
            field: 'label',
            type: 'nominal',
            title: null,
            sort: model.lifelines.map((lifeline) => lifeline.label),
          },
          color: {
            field: 'label',
            type: 'nominal',
            legend: null,
            scale: { range: [...theme.seriesValues] },
          },
          tooltip: [
            { field: 'id' },
            { field: 'label' },
            { field: 'start', type: 'temporal' },
            { field: 'end', type: 'temporal' },
          ],
          ...highlightEncoding(controls),
        },
      },
      lineLayer(activityRows, 'activity'),
      lineLayer(metricsRows, 'metrics'),
    ],
    resolve: { scale: { x: 'shared' } },
    config: asimovVegaConfig(input),
  }
}

interface RankingLike {
  nodeId: string
  score: number
  rank: number
}

/** Centrality: horizontal ranked bars (bar length data-driven, A1). */
export function buildCentralitySpec(
  rankings: readonly RankingLike[],
  input: AsimovVegaCompileInput,
): PlainSpec {
  const theme = input.theme ?? ASIMOV_VISUALIZATION_THEME
  const { controls } = input
  const ordered = [...rankings].sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score
    return left.nodeId.localeCompare(right.nodeId)
  })
  const maxScore = ordered[0]?.score ?? 1
  const zoom = controls.interaction.zoomFactor
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 'container',
    autosize: { type: 'fit-x', resize: true },
    height: Math.max(theme.geometry.laneStep * Math.max(1, ordered.length), theme.geometry.laneStep * 3),
    data: {
      values: ordered.map((ranking) => ({
        id: ranking.nodeId,
        nodeId: ranking.nodeId,
        score: ranking.score,
        rank: ranking.rank,
      })),
    },
    params: asimovVegaParams(controls),
    mark: { type: 'bar', tooltip: true, aria: true, height: { band: 0.6 } },
    encoding: {
      y: {
        field: 'nodeId',
        type: 'nominal',
        title: null,
        sort: ordered.map((ranking) => ranking.nodeId),
      },
      x: {
        field: 'score',
        type: 'quantitative',
        title: null,
        scale: { domain: [0, zoom > 1 ? maxScore / zoom : maxScore] },
      },
      color: { value: theme.seriesValues[0] },
      tooltip: [{ field: 'nodeId' }, { field: 'score' }, { field: 'rank' }],
      ...highlightEncoding(controls),
    },
    config: asimovVegaConfig(input),
  }
}
