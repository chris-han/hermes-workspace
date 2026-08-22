import { useMemo, useState } from 'react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'

import type { AnalyticsShowcaseAdapterResult } from '../adapters/analytics-showcase-adapter'
import { snapSizeToAsimovGrid, snapToAsimovGrid } from '../visualization/asimov-visualization-spatial'
import {
  DEFAULT_VISUALIZATION_CONTROL_STATE
  
} from '../visualization/visualization-control-state'
import type {VisualizationControlState} from '../visualization/visualization-control-state';
import { VisualizationShell } from '../visualization/visualization-shell'
import { ChartVisualizationFooter, VisualizationFooter } from '../visualization/visualization-footer'
import {
  asimovSeriesColor,
  compileAsimovChartConfig,
} from '../visualization/recharts-svg/asimov-chart-compiler'
import { ShowcaseSigmaCanvas } from './shared/showcase-sigma-canvas'

/**
 * Analytics showcase visual encodings (plan
 * `2026-08-22-semantica-renderer-visual-parity-remediation-v1`):
 * Centrality = ranked horizontal bar chart; Communities = community-colored
 * KG on the readonly Sigma canvas (`node.color` carries the deterministic
 * Asimov categorical community color; `group` retains the community id).
 *
 * Theme/spatial migration (plan
 * `2026-08-22-asimov-visualization-layout-system-theme-refactor-v1`, W4/W5 on
 * the documented §7.1 Recharts/SVG fallback): geometry, fonts, and colors
 * compile from the canonical `ASIMOV_VISUALIZATION_THEME` + 24px lattice
 * tokens; bar LENGTH stays data-driven from the centrality score (A1) while
 * row height/viewport snap to the lattice; both submodes mount through the
 * shared VisualizationShell/Footer (A8).
 */

export interface AnalyticsShowcaseSelectionProps {
  selection?: string | null
  onSelect?: (selection: string | null) => void
}

export function AnalyticsShowcaseView({
  adapter,
  selection,
  onSelect,
}: { adapter: AnalyticsShowcaseAdapterResult } & AnalyticsShowcaseSelectionProps) {
  const [controls, setControls] = useState<VisualizationControlState>({
    ...DEFAULT_VISUALIZATION_CONTROL_STATE,
    renderer: 'recharts-svg',
  })
  const chartConfig = useMemo(() => compileAsimovChartConfig(controls), [controls])
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto" data-testid="analytics-showcase-view">
      {adapter.kind === 'centrality' ? (
        <CentralityBars
          adapter={adapter}
          selection={selection}
          onSelect={onSelect}
          controls={controls}
          onControlsChange={setControls}
        />
      ) : null}
      {adapter.kind === 'communities' ? (
        <VisualizationShell
          testId="analytics-communities-visualization"
          ariaLabel="Community structure visualization"
          className="min-h-0 flex-1"
          footer={
            <VisualizationFooter
              rendererTag="SIGMA · WEBGL"
              summary="Force-directed"
            />
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <h3 className="font-mono text-sm font-semibold">Communities</h3>
            <div className="flex min-h-[360px] flex-1">
              <ShowcaseSigmaCanvas
                model={{ nodes: adapter.graph.nodes, edges: adapter.graph.edges }}
                selection={selection ? { type: 'node', id: selection } : null}
                ariaLabel="Community-colored knowledge graph canvas"
                onSelect={(next) => onSelect?.(next?.type === 'node' ? next.id : null)}
              />
            </div>
          </div>
        </VisualizationShell>
      ) : null}
    </div>
  )
}

type CentralityBarShapeProps = {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: { nodeId: string; score: number; rank: number }
}

function CentralityBars({
  adapter,
  selection,
  onSelect,
  controls,
  onControlsChange,
}: { adapter: Extract<AnalyticsShowcaseAdapterResult, { kind: 'centrality' }> } & AnalyticsShowcaseSelectionProps & {
  controls: VisualizationControlState
  onControlsChange: (next: VisualizationControlState) => void
}) {
  const config = useMemo(() => compileAsimovChartConfig(controls), [controls])
  // Presentation geometry: bar-row height and panel height snap to the 24px
  // lattice; bar length stays data-driven from the score (A1).
  const rowHeight = config.geometry.laneStep
  const height = snapSizeToAsimovGrid(Math.max(120, adapter.rankings.length * rowHeight + config.geometry.viewportPaddingY))
  // Zoom narrows the visible score domain around zero (deterministic);
  // zoom 1 shows the full extent, FIT resets to it.
  const zoom = config.interaction.zoomFactor
  const maxScore = adapter.rankings[0]?.score ?? 1
  const selectEnabled = config.interaction.select
  return (
    <VisualizationShell
      testId="analytics-centrality-visualization"
      ariaLabel="Centrality visualization"
      footer={
        <ChartVisualizationFooter
          rendererTag="RECHARTS · SVG"
          summary="Ranked bars"
          controls={controls}
          onControlsChange={onControlsChange}
        />
      }
    >
      <div>
        <h3 className="font-mono text-sm font-semibold">Centrality</h3>
        <BarChart
          width={snapToAsimovGrid(720)}
          height={height}
          data={adapter.rankings}
          layout="vertical"
          className="mt-2 w-full"
        >
          <XAxis
            type="number"
            tick={config.axis.tick}
            hide={!config.axis.visibleX}
            domain={[0, maxScore / zoom]}
            allowDataOverflow={zoom > 1}
          />
          <YAxis
            type="category"
            dataKey="nodeId"
            tick={{ ...config.axis.tick, fontSize: 11 }}
            width={96}
            hide={!config.axis.visibleY}
          />
          <Bar
            dataKey="score"
            isAnimationActive={false}
            shape={(shapeProps: CentralityBarShapeProps) => {
              const nodeId = shapeProps.payload?.nodeId ?? ''
              const isSelected = selection === nodeId
              return (
                <rect
                  data-testid={`analytics-centrality-bar-${nodeId}`}
                  x={shapeProps.x ?? 0}
                  y={shapeProps.y ?? 0}
                  width={shapeProps.width ?? 0}
                  height={shapeProps.height ?? 0}
                  rx={2}
                  fill={isSelected ? 'var(--asimov-brand)' : asimovSeriesColor(0)}
                  opacity={selection && !isSelected ? 0.45 : config.mark.opacity}
                  role="button"
                  aria-label={`${nodeId} · ${shapeProps.payload?.score.toFixed(3) ?? ''}`}
                  onClick={selectEnabled ? () => onSelect?.(isSelected ? null : nodeId) : undefined}
                />
              )
            }}
          />
        </BarChart>
      </div>
    </VisualizationShell>
  )
}
