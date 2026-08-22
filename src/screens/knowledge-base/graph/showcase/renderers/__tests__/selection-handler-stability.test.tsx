// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const canvasPropsLog: Array<{ onSelect?: unknown }> = []

vi.mock('../shared/showcase-sigma-canvas', async () => {
  const actual = await vi.importActual<typeof import('../shared/showcase-sigma-canvas')>('../shared/showcase-sigma-canvas')
  return {
    ...actual,
    ShowcaseSigmaCanvas: (props: { onSelect?: unknown }) => {
      canvasPropsLog.push({ onSelect: props.onSelect })
      return <div data-testid="mock-showcase-sigma-canvas" />
    },
  }
})

import { OntologyShowcaseView } from '../ontology-showcase-view'
import { EmbeddingShowcaseView } from '../embedding-showcase-view'
import type {
  ShowcaseEmbeddingRendererInput,
  ShowcaseOntologyRendererInput,
} from '../../semantica-showcase-types'

const EMPTY_INSPECTOR = {
  title: 'No selection',
  emptyLabel: 'Click an item to inspect',
  fields: [],
}

const ONTOLOGY_INPUT: ShowcaseOntologyRendererInput = {
  model: {
    nodes: [
      { id: 'root', label: 'Root' },
      { id: 'child', label: 'Child' },
    ],
    edges: [{ id: 'e1', source: 'root', target: 'child' }],
  },
  classes: [],
  properties: [],
  inspector: EMPTY_INSPECTOR,
  metrics: [],
}

const EMBEDDING_INPUT: ShowcaseEmbeddingRendererInput = {
  model: {
    nodes: [{ id: 'item-1', label: 'Item 1' }],
    edges: [],
  },
  items: [{ id: 'item-1', label: 'Item 1', x: 0, y: 0, text: 'stub' }],
  inspector: EMPTY_INSPECTOR,
  metrics: [],
}

describe('showcase selection handler stability', () => {
  it('keeps ontology canvas onSelect handler stable across rerenders', () => {
    canvasPropsLog.length = 0
    const onSelect = vi.fn()

    const { rerender } = render(
      <OntologyShowcaseView
        input={ONTOLOGY_INPUT}
        hierarchy={[]}
        maxDepth={1}
        selectedClassId={undefined}
        onSelect={onSelect}
      />,
    )

    rerender(
      <OntologyShowcaseView
        input={ONTOLOGY_INPUT}
        hierarchy={[]}
        maxDepth={1}
        selectedClassId={'root'}
        onSelect={onSelect}
      />,
    )

    expect(canvasPropsLog.length).toBeGreaterThanOrEqual(2)
    expect(canvasPropsLog[0]?.onSelect).toBe(canvasPropsLog[1]?.onSelect)
  })

  it('keeps embedding canvas onSelect handler stable across rerenders', () => {
    canvasPropsLog.length = 0
    const onSelect = vi.fn()

    const { rerender } = render(
      <EmbeddingShowcaseView
        input={EMBEDDING_INPUT}
        selectedItemId={undefined}
        onSelect={onSelect}
      />,
    )

    rerender(
      <EmbeddingShowcaseView
        input={EMBEDDING_INPUT}
        selectedItemId={'item-1'}
        onSelect={onSelect}
      />,
    )

    expect(canvasPropsLog.length).toBeGreaterThanOrEqual(2)
    expect(canvasPropsLog[0]?.onSelect).toBe(canvasPropsLog[1]?.onSelect)
  })
})
