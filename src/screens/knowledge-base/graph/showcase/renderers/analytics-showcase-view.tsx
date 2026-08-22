import { useMemo, useState } from 'react'
import { VegaEmbed } from 'react-vega'
import { expressionInterpreter } from 'vega-interpreter'

import type { AnalyticsShowcaseAdapterResult } from '../adapters/analytics-showcase-adapter'
import {
  DEFAULT_VISUALIZATION_CONTROL_STATE
} from '../visualization/visualization-control-state'
import type { VisualizationControlState } from '../visualization/visualization-control-state'
import { VisualizationShell } from '../visualization/visualization-shell'
import { ChartVisualizationFooter, VisualizationFooter } from '../visualization/visualization-footer'
import { buildCentralitySpec } from '../visualization/vega-lite/asimov-vega-compiler'
import { ShowcaseSigmaCanvas } from './shared/showcase-sigma-canvas'

/**
 * Analytics showcase visual encodings (plan
 * `2026-08-22-semantica-renderer-visual-parity-remediation-v1`) on the
 * Vega-Lite chart engine (plan
 * `2026-08-22-semantica-vega-lite-chart-engine-v1`): Centrality is a compiled
 * Vega-Lite ranked horizontal bar chart (bar LENGTH stays data-driven from
 * the score, A1); Communities is the community-colored KG on the readonly
 * Sigma canvas (`node.color` carries the deterministic Asimov categorical
 * community color; `group` retains the community id, A11). Both submodes
 * mount through the shared VisualizationShell/Footer (A8).
 */

export interface AnalyticsShowcaseSelectionProps {
  selection?: string | null
  onSelect?: (selection: string | null) => void
}

// CSP-safe: the workspace CSP forbids unsafe-eval, so Vega expressions run
// through the AST interpreter instead of the default Function compiler.
const VEGA_EMBED_OPTIONS = { actions: false, renderer: 'svg' as const, ast: true, expr: expressionInterpreter }

export function AnalyticsShowcaseView({
  adapter,
  selection,
  onSelect,
}: { adapter: AnalyticsShowcaseAdapterResult } & AnalyticsShowcaseSelectionProps) {
  const [controls, setControls] = useState<VisualizationControlState>(DEFAULT_VISUALIZATION_CONTROL_STATE)
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
  const spec = useMemo(() => buildCentralitySpec(adapter.rankings, { controls }), [adapter.rankings, controls])
  return (
    <VisualizationShell
      testId="analytics-centrality-visualization"
      ariaLabel="Centrality visualization"
      footer={
        <ChartVisualizationFooter
          rendererTag="VEGA · SVG"
          summary="Ranked bars"
          controls={controls}
          onControlsChange={onControlsChange}
        />
      }
    >
      <div>
        <h3 className="font-mono text-sm font-semibold">Centrality</h3>
        <div className="mt-2" data-testid="analytics-centrality-bars">
          <VegaEmbed
            spec={spec}
            options={VEGA_EMBED_OPTIONS}
            // react-vega v8 has no `signalListeners` prop; the Vega `pick`
            // param listener attaches via `onEmbed` in Select mode only.
            {...(controls.interaction.mode === 'select' && onSelect
              ? {
                  onEmbed: (result: unknown) => {
                    const view = (
                      result as {
                        view: { addSignalListener: (n: string, fn: (n: string, v: unknown) => void) => void }
                      } | null
                    )?.view
                    if (!view) return
                    view.addSignalListener('pick', (_name: string, value: unknown) => {
                      const ids = (value as { id?: unknown[] })?.id
                      const next = Array.isArray(ids) && ids.length > 0 ? String(ids[0]) : null
                      onSelect(next === selection ? null : next)
                    })
                  },
                }
              : {})}
          />
        </div>
      </div>
    </VisualizationShell>
  )
}
