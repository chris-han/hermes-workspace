/**
 * Embedding showcase adapter.
 *
 * The frozen 2D coordinates come from the deterministic hash-based projection
 * recorded in the fixture manifest. No live embedding model or provider call
 * is ever made from this code path.
 */
import type {
  ShowcaseEmbeddingFixture,
  ShowcaseEmbeddingItem,
  ShowcaseEmbeddingRendererInput,
  ShowcaseInspectorField,
  ShowcaseInspectorModel,
  ShowcaseMetric,
} from '../semantica-showcase-types'

export interface EmbeddingAdapterResult {
  renderer: ShowcaseEmbeddingRendererInput
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
}

export function adaptEmbeddingFixture(
  fixture: ShowcaseEmbeddingFixture,
  selectedItemId?: string,
): EmbeddingAdapterResult {
  const items = fixture.items
  const xs = items.map((item) => item.x)
  const ys = items.map((item) => item.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)

  const metrics: ShowcaseMetric[] = [
    { label: 'Points', value: String(items.length) },
    { label: 'Rendered dimension', value: '2D', hint: 'Frozen deterministic 2D projection' },
    {
      label: 'X range',
      value: `[${xMin.toFixed(2)}, ${xMax.toFixed(2)}]`,
      hint: 'Source-text derived; not measured live',
    },
    {
      label: 'Y range',
      value: `[${yMin.toFixed(2)}, ${yMax.toFixed(2)}]`,
      hint: 'Source-text derived; not measured live',
    },
  ]

  return {
    renderer: {
      items,
      inspector: buildInspector(items, selectedItemId),
      metrics,
    },
    inspector: buildInspector(items, selectedItemId),
    metrics,
  }
}

function buildInspector(
  items: ShowcaseEmbeddingItem[],
  selectedItemId?: string,
): ShowcaseInspectorModel {
  if (!selectedItemId) {
    return {
      title: 'No point selected',
      emptyLabel: 'Hover or click a point to inspect',
      fields: [],
    }
  }
  const item = items.find((candidate) => candidate.id === selectedItemId)
  if (!item) {
    return {
      title: 'Unknown point',
      emptyLabel: `Point "${selectedItemId}" is not in this fixture.`,
      fields: [],
    }
  }
  const fields: ShowcaseInspectorField[] = [
    { label: 'id', value: item.id, mono: true },
    { label: 'label', value: item.label },
    { label: 'source text', value: item.text, mono: true },
    { label: 'x', value: item.x.toFixed(6), mono: true },
    { label: 'y', value: item.y.toFixed(6), mono: true },
    {
      label: 'provenance',
      value: 'Sample coordinates frozen from Semantica visualization fixture; no live embedding provider used.',
    },
  ]
  return {
    title: item.label,
    subtitle: item.text,
    emptyLabel: '',
    fields,
  }
}
