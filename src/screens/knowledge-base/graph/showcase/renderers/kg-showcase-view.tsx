import type { ShowcaseKgRendererInput } from '../semantica-showcase-types'
import type { SigmaGraphReadonlySelection } from '../../sigma-graph-readonly'
import type { ShowcaseInspectorField } from '../semantica-showcase-types'
import { ShowcaseSigmaCanvas } from './shared/showcase-sigma-canvas'
import type { ShowcaseCanvasViewportProps } from './shared/showcase-sigma-canvas'

export function KgShowcaseView({
  input,
  onSelect,
  selection,
  positions,
  sigmaControls,
  onViewportReady,
  onCameraChange,
  renderEdgeLabels = true,
  showNodeDetail = true,
}: {
  input: ShowcaseKgRendererInput
  onSelect: (selection: SigmaGraphReadonlySelection) => void
  selection?: SigmaGraphReadonlySelection
  renderEdgeLabels?: boolean
  showNodeDetail?: boolean
} & ShowcaseCanvasViewportProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full" data-testid="kg-showcase-view">
      <ShowcaseSigmaCanvas
        model={input.model}
        positions={positions}
        sigmaControls={sigmaControls}
        selection={selection}
        ariaLabel="Knowledge graph showcase"
        renderEdgeLabels={renderEdgeLabels}
        onSelect={onSelect}
        onViewportReady={onViewportReady}
        onCameraChange={onCameraChange}
      />
      {showNodeDetail ? (
        <div className="showcase-ref-floating-detail-wrap" aria-hidden="true">
          <InspectorSummary fields={input.inspector.fields} />
        </div>
      ) : null}
    </div>
  )
}

function InspectorSummary({ fields }: { fields: ShowcaseInspectorField[] }) {
  if (!fields.length) {
    return null
  }
  return (
    <div
      className="showcase-ref-floating-detail rounded-md border border-border bg-card/60 px-3 py-2 font-mono text-xs text-muted-foreground"
      data-testid="kg-showcase-summary"
    >
      {fields.map((field) => (
        <div key={field.label} className="showcase-ref-floating-detail-row">
          <span className="showcase-ref-floating-detail-label">{field.label}</span>
          <span className="showcase-ref-floating-detail-value">{field.value}</span>
        </div>
      ))}
    </div>
  )
}
