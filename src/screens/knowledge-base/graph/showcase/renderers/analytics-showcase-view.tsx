import { Bar, BarChart, XAxis, YAxis } from 'recharts'

import type { AnalyticsShowcaseAdapterResult } from '../adapters/analytics-showcase-adapter'
import { ShowcaseSigmaCanvas } from './shared/showcase-sigma-canvas'

/**
 * Analytics showcase visual encodings (plan
 * `2026-08-22-semantica-renderer-visual-parity-remediation-v1`):
 * Centrality = ranked horizontal bar chart; Communities = community-colored
 * KG on the readonly Sigma canvas (`node.color` carries the deterministic
 * Asimov categorical community color; `group` retains the community id).
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
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto" data-testid="analytics-showcase-view">
      {adapter.kind === 'centrality' ? (
        <CentralityBars adapter={adapter} selection={selection} onSelect={onSelect} />
      ) : null}
      {adapter.kind === 'communities' ? (
        <section
          className="showcase-ref-panel flex min-h-0 flex-1 flex-col p-3"
          data-testid="analytics-communities-visualization"
        >
          <h3 className="font-mono text-sm font-semibold">Communities</h3>
          <div className="flex min-h-[360px] flex-1">
            <ShowcaseSigmaCanvas
              model={{ nodes: adapter.graph.nodes, edges: adapter.graph.edges }}
              selection={selection ? { type: 'node', id: selection } : null}
              ariaLabel="Community-colored knowledge graph canvas"
              onSelect={(next) => onSelect?.(next?.type === 'node' ? next.id : null)}
            />
          </div>
        </section>
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
}: { adapter: Extract<AnalyticsShowcaseAdapterResult, { kind: 'centrality' }> } & AnalyticsShowcaseSelectionProps) {
  return (
    <section className="showcase-ref-panel p-3" data-testid="analytics-centrality-visualization">
      <h3 className="font-mono text-sm font-semibold">Centrality</h3>
      <BarChart
        width={720}
        height={Math.max(120, adapter.rankings.length * 44 + 24)}
        data={adapter.rankings}
        layout="vertical"
        className="mt-2 w-full"
      >
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="nodeId" tick={{ fontSize: 11 }} width={96} />
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
                fill={isSelected ? 'var(--asimov-brand)' : 'var(--asimov-visualization-swatch-cobalt)'}
                opacity={selection && !isSelected ? 0.45 : 0.9}
                role="button"
                aria-label={`${nodeId} · ${shapeProps.payload?.score.toFixed(3) ?? ''}`}
                onClick={() => onSelect?.(isSelected ? null : nodeId)}
              />
            )
          }}
        />
      </BarChart>
    </section>
  )
}
