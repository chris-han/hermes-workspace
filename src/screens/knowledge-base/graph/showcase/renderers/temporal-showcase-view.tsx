import { useMemo, useState } from 'react'
import { VegaEmbed } from 'react-vega'
import { expressionInterpreter } from 'vega-interpreter'

import type { TemporalShowcaseAdapterResult } from '../adapters/temporal-showcase-adapter'
import type { ShowcaseGraphModel } from '../semantica-showcase-types'
import { computeGraphTopology } from '../../layouts/graph-topology-layouts'
import {
  DEFAULT_VISUALIZATION_CONTROL_STATE
} from '../visualization/visualization-control-state'
import type { VisualizationControlState } from '../visualization/visualization-control-state'
import { VisualizationShell } from '../visualization/visualization-shell'
import { ChartVisualizationFooter, VisualizationFooter } from '../visualization/visualization-footer'
import {
  buildGanttTimelineSpec,
  buildTemporalDashboardSpec,
  buildVersionLadderSpec,
} from '../visualization/vega-lite/asimov-vega-compiler'
import { ShowcaseSigmaCanvas } from './shared/showcase-sigma-canvas'

/**
 * Temporal showcase visual encodings on the Vega-Lite chart engine (plan
 * `2026-08-22-semantica-vega-lite-chart-engine-v1`, which amends the parent
 * visualization plan's §7.1 Recharts/SVG fallback).
 *
 * Timeline is a GANTT chart: events are point-in-time, so each bar spans its
 * timestamp to the next event in the same lane (see `deriveGanttRows`).
 * Versions renders as a connected chronological ladder; the Dashboard is a
 * `vconcat` of lifelines Gantt + activity + metrics panels sharing the time
 * scale. Every spec compiles deterministically from the canonical
 * `ASIMOV_VISUALIZATION_THEME` + validated `VisualizationControlState` (A12);
 * Vega-native tooltip/hover/pan-zoom/click-select interactivity is compiled
 * into the spec params. Evolution stays on Sigma (A11) and every submode
 * mounts through the shared VisualizationShell/Footer (A8).
 */

export interface TemporalShowcaseSelectionProps {
  selection?: string | null
  onSelect?: (selection: string | null) => void
}

/** Signal-listener props wiring the Vega `pick` param into the selection flow. */
function pickSignalProps(
  controls: VisualizationControlState,
  selection: string | null | undefined,
  onSelect: ((selection: string | null) => void) | undefined,
) {
  if (controls.interaction.mode !== 'select' || !onSelect) return {}
  return {
    signalListeners: {
      pick: (_name: string, value: unknown) => {
        const ids = (value as { id?: unknown[] })?.id
        const next = Array.isArray(ids) && ids.length > 0 ? String(ids[0]) : null
        onSelect(next === selection ? null : next)
      },
    },
  }
}

// CSP-safe: the workspace CSP forbids unsafe-eval, so Vega expressions run
// through the AST interpreter instead of the default Function compiler.
const VEGA_EMBED_OPTIONS = { actions: false, renderer: 'svg' as const, ast: true, expr: expressionInterpreter }

export function TemporalShowcaseView({
  adapter,
  selection,
  onSelect,
}: { adapter: TemporalShowcaseAdapterResult } & TemporalShowcaseSelectionProps) {
  // Renderer-neutral control state for the chart-native submodes (W6,
  // UI-scoped; the AI path is deferred per plan §9.3/W6-04).
  const [controls, setControls] = useState<VisualizationControlState>(DEFAULT_VISUALIZATION_CONTROL_STATE)
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto" data-testid="temporal-showcase-view">
      {adapter.kind === 'timeline' ? (
        <TimelineGantt
          adapter={adapter}
          selection={selection}
          onSelect={onSelect}
          controls={controls}
          onControlsChange={setControls}
        />
      ) : null}
      {adapter.kind === 'version-history' ? (
        <VersionsLadder
          adapter={adapter}
          selection={selection}
          onSelect={onSelect}
          controls={controls}
          onControlsChange={setControls}
        />
      ) : null}
      {adapter.kind === 'temporal-dashboard' ? (
        <DashboardCharts
          adapter={adapter}
          selection={selection}
          onSelect={onSelect}
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
  // ChartVisualizationFooter; chart views only supply tag/type text.
  return (
    <ChartVisualizationFooter
      rendererTag={rendererTag}
      summary={summary}
      controls={controls}
      onControlsChange={onControlsChange}
    />
  )
}

function TimelineGantt({
  adapter,
  selection,
  onSelect,
  controls,
  onControlsChange,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'timeline' }> } & TemporalShowcaseSelectionProps & ChartViewProps) {
  const spec = useMemo(
    () => buildGanttTimelineSpec(adapter.lanes, adapter.timeBounds, { controls }),
    [adapter.lanes, adapter.timeBounds, controls],
  )
  return (
    <VisualizationShell
      testId="temporal-timeline-visualization"
      ariaLabel="Timeline visualization"
      footer={
        <ChartFooter
          rendererTag="VEGA · SVG"
          summary="Gantt"
          controls={controls}
          onControlsChange={onControlsChange}
        />
      }
    >
      <div>
        <h3 className="font-mono text-sm font-semibold">Timeline</h3>
        <div className="mt-2" data-testid="temporal-timeline-gantt">
          <VegaEmbed
            spec={spec}
            options={VEGA_EMBED_OPTIONS}
            {...pickSignalProps(controls, selection, onSelect)}
          />
        </div>
      </div>
    </VisualizationShell>
  )
}

function VersionsLadder({
  adapter,
  selection,
  onSelect,
  controls,
  onControlsChange,
}: { adapter: Extract<TemporalShowcaseAdapterResult, { kind: 'version-history' }> } & TemporalShowcaseSelectionProps & ChartViewProps) {
  const spec = useMemo(
    () => buildVersionLadderSpec(adapter.versions, adapter.timeBounds, { controls }),
    [adapter.versions, adapter.timeBounds, controls],
  )
  return (
    <VisualizationShell
      testId="temporal-versions-visualization"
      ariaLabel="Version history visualization"
      footer={
        <ChartFooter
          rendererTag="VEGA · SVG"
          summary="Ladder"
          controls={controls}
          onControlsChange={onControlsChange}
        />
      }
    >
      <div>
        <h3 className="font-mono text-sm font-semibold">Version History</h3>
        <div className="mt-2" data-testid="temporal-versions-ladder">
          <VegaEmbed
            spec={spec}
            options={VEGA_EMBED_OPTIONS}
            {...pickSignalProps(controls, selection, onSelect)}
          />
        </div>
      </div>
    </VisualizationShell>
  )
}

function DashboardCharts({
  adapter,
  selection,
  onSelect,
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
  const spec = useMemo(
    () =>
      buildTemporalDashboardSpec(
        {
          lifelines: adapter.lifelines,
          activity: adapter.activity,
          metricsSeries: adapter.metricsSeries ?? [],
          timeBounds: bounds,
        },
        { controls },
      ),
    [adapter.lifelines, adapter.activity, adapter.metricsSeries, bounds, controls],
  )
  return (
    <VisualizationShell
      testId="temporal-dashboard-visualization"
      ariaLabel="Temporal dashboard visualization"
      footer={
        <ChartFooter
          rendererTag="VEGA · SVG"
          summary="Small multiples"
          controls={controls}
          onControlsChange={onControlsChange}
        />
      }
    >
      <div>
        <h3 className="font-mono text-sm font-semibold">Dashboard</h3>
        <div className="mt-2" data-testid="temporal-dashboard-panels">
          <VegaEmbed
            spec={spec}
            options={VEGA_EMBED_OPTIONS}
            {...pickSignalProps(controls, selection, onSelect)}
          />
        </div>
      </div>
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
      footer={
        <VisualizationFooter
          rendererTag="SIGMA · WEBGL"
          summary="Force-directed"
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
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
    </VisualizationShell>
  )
}
