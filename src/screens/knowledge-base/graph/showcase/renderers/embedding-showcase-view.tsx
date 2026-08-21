import { useMemo } from 'react'

import type { ShowcaseEmbeddingRendererInput } from '../semantica-showcase-types'

const POINT_RADIUS = 6
const VIEWBOX_W = 600
const VIEWBOX_H = 400
const PADDING = 32

export function EmbeddingShowcaseView({
  input,
  selectedItemId,
  onSelect,
}: {
  input: ShowcaseEmbeddingRendererInput
  selectedItemId?: string
  onSelect: (itemId: string) => void
}) {
  const projected = useMemo(() => projectPoints(input.items), [input.items])

  return (
    <div className="flex h-full w-full flex-col gap-3" data-testid="embedding-showcase-view">
      <div className="relative flex-1 overflow-hidden rounded-md border border-border bg-card">
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          className="h-full w-full"
          role="img"
          aria-label="Embedding scatter plot"
          data-testid="embedding-scatter"
        >
          <rect x={0} y={0} width={VIEWBOX_W} height={VIEWBOX_H} fill="transparent" />
          {projected.map((p) => (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.id === selectedItemId ? POINT_RADIUS + 2 : POINT_RADIUS}
                fill={p.id === selectedItemId ? '#2563eb' : '#0ea5e9'}
                fillOpacity={0.85}
                stroke="#0f172a"
                strokeWidth={1}
                onClick={() => onSelect(p.id)}
                onMouseEnter={() => onSelect(p.id)}
                style={{ cursor: 'pointer' }}
                data-testid={`embedding-point-${p.label}`}
              />
              <text
                x={p.x + POINT_RADIUS + 4}
                y={p.y + 4}
                fontSize="12"
                fontFamily="JetBrains Mono, monospace"
                fill="#e2e8f0"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
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

function projectPoints(items: ShowcaseEmbeddingRendererInput['items']) {
  if (items.length === 0) return []
  const xs = items.map((item) => item.x)
  const ys = items.map((item) => item.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    x: PADDING + ((item.x - xMin) / xSpan) * (VIEWBOX_W - 2 * PADDING),
    y: PADDING + (1 - (item.y - yMin) / ySpan) * (VIEWBOX_H - 2 * PADDING),
  }))
}
