import { useMemo } from 'react'

import type { ShowcaseEmbeddingRendererInput } from '../semantica-showcase-types'
import {
  handleNodeSelection,
  selectionForNode,
  ShowcaseSigmaCanvas,
} from './shared/showcase-sigma-canvas'
import type { ShowcaseCanvasViewportProps } from './shared/showcase-sigma-canvas'

export function EmbeddingShowcaseView({
  input,
  selectedItemId,
  onSelect,
  positions,
  sigmaControls,
  onViewportReady,
  renderEdgeLabels = false,
}: {
  input: ShowcaseEmbeddingRendererInput
  selectedItemId?: string
  onSelect: (itemId: string) => void
  renderEdgeLabels?: boolean
} & ShowcaseCanvasViewportProps) {
  const ordered = useMemo(
    () => [...input.items].sort((a, b) => a.label.localeCompare(b.label)),
    [input.items],
  )

  return (
    <div className="flex h-full w-full flex-col gap-3" data-testid="embedding-showcase-view">
      <div data-testid="embedding-scatter" className="min-h-0 flex-1">
        <ShowcaseSigmaCanvas
          model={input.model}
          positions={positions ?? input.positions}
          sigmaControls={sigmaControls}
          selection={selectionForNode(selectedItemId)}
          ariaLabel="Embedding scatter plot"
          renderEdgeLabels={renderEdgeLabels}
          onViewportReady={onViewportReady}
          onSelect={handleNodeSelection(onSelect)}
        />
      </div>
      <div className="sr-only">
        {ordered.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`embedding-point-${item.label}`}
            aria-pressed={selectedItemId === item.id}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground"
        data-testid="embedding-offline-disclosure"
      >
        Sample coordinates frozen from Semantica visualization fixture; no live embedding
        provider used.
      </div>
    </div>
  )
}
