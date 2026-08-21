import type { SigmaGraphReadonlySelection } from '../../sigma-graph-readonly'
import type { ShowcaseSemanticNetworkRendererInput } from '../semantica-showcase-types'
import { ShowcaseSigmaCanvas } from './shared/showcase-sigma-canvas'
import type { ShowcaseCanvasViewportProps } from './shared/showcase-sigma-canvas'

export function SemanticNetworkShowcaseView({
  input,
  onSelect,
  positions,
  onViewportReady,
}: {
  input: ShowcaseSemanticNetworkRendererInput
  onSelect: (selection: SigmaGraphReadonlySelection) => void
} & ShowcaseCanvasViewportProps) {
  return (
    <div className="flex h-full w-full flex-col gap-3" data-testid="semantic-network-showcase-view">
      <ShowcaseSigmaCanvas
        model={input.model}
        positions={positions}
        selection={null}
        ariaLabel="Semantic network showcase"
        onSelect={onSelect}
        onViewportReady={onViewportReady}
      />
    </div>
  )
}
