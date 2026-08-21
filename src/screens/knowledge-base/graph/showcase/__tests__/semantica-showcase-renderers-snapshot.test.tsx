// @vitest-environment jsdom

/**
 * W0-03 baseline snapshot tests for the four Semantica showcase renderers.
 *
 * These tests capture the DOM structure rendered by `KgShowcaseView`,
 * `OntologyShowcaseView`, `EmbeddingShowcaseView`, and
 * `SemanticNetworkShowcaseView` when driven by the pinned intro-cookbook-kg
 * fixture. They exist as a regression baseline before the corpus expansion
 * (W1-W7) introduces new datasets.
 *
 * Sigma is mocked at module load time because it requires WebGL2, which
 * jsdom does not provide. The screen-shell contract is what we are
 * snapshotting here; Sigma's actual rendering is exercised by Playwright
 * against the remote Chrome CDP at port 9222 (parent plan W7).
 *
 * If the snapshot output changes, the change must be deliberate and reviewed
 * against §A6 (shared renderers, no dataset-specific pages).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sigma', () => ({
  default: class FakeSigma {
    on() {
      return this
    }
    kill() {
      return this
    }
  },
}))

import { cleanup, fireEvent, render } from '@testing-library/react'

import { KgShowcaseView } from '../renderers/kg-showcase-view'
import { OntologyShowcaseView } from '../renderers/ontology-showcase-view'
import { EmbeddingShowcaseView } from '../renderers/embedding-showcase-view'
import { SemanticNetworkShowcaseView } from '../renderers/semantic-network-showcase-view'

import { adaptKgFixture } from '../adapters/kg-showcase-adapter'
import { adaptOntologyFixture } from '../adapters/ontology-showcase-adapter'
import { adaptEmbeddingFixture } from '../adapters/embedding-showcase-adapter'
import { adaptSemanticNetworkFixture } from '../adapters/semantic-network-showcase-adapter'

import { getDataset, listDatasetIds } from '../semantica-showcase-dataset'

afterEach(() => {
  cleanup()
})

function introDataset() {
  const id = listDatasetIds()[0]!
  return getDataset(id)
}

describe('KgShowcaseView — W0-03 DOM snapshot baseline', () => {
  it('renders the pinned intro fixture with the expected testids and summary', () => {
    const dataset = introDataset()
    expect(dataset.kg, 'intro kg payload missing').toBeDefined()
    const adapter = adaptKgFixture(dataset.kg!)
    const { container, getByTestId } = render(
      <KgShowcaseView input={adapter.renderer} onSelect={() => undefined} />,
    )
    expect(getByTestId('kg-showcase-view')).toBeDefined()
    expect(container).toMatchSnapshot()
  })

  it('fires a nudge action when the canvas control is pressed', () => {
    const dataset = introDataset()
    expect(dataset.kg, 'intro kg payload missing').toBeDefined()
    const adapter = adaptKgFixture(dataset.kg!)
    const onNudge = vi.fn()
    const { getByRole } = render(
      <KgShowcaseView input={adapter.renderer} onSelect={() => undefined} onNudge={onNudge} />,
    )

    fireEvent.click(getByRole('button', { name: 'Nudge' }))
    expect(onNudge).toHaveBeenCalledTimes(1)
  })
})

describe('OntologyShowcaseView — W0-03 DOM snapshot baseline', () => {
  it('renders the pinned intro fixture with the expected tree testids', () => {
    const dataset = introDataset()
    expect(dataset.ontology, 'intro ontology payload missing').toBeDefined()
    const adapter = adaptOntologyFixture(dataset.ontology!)
    const { container, getByTestId } = render(
      <OntologyShowcaseView
        input={adapter.renderer}
        hierarchy={adapter.hierarchy}
        maxDepth={adapter.maxDepth}
        onSelect={() => undefined}
      />,
    )
    expect(getByTestId('ontology-showcase-view')).toBeDefined()
    expect(getByTestId('ontology-tree')).toBeDefined()
    expect(container).toMatchSnapshot()
  })
})

describe('EmbeddingShowcaseView — W0-03 DOM snapshot baseline', () => {
  it('renders the pinned intro fixture with the expected SVG and offline disclosure', () => {
    const dataset = introDataset()
    expect(dataset.embedding, 'intro embedding payload missing').toBeDefined()
    const adapter = adaptEmbeddingFixture(dataset.embedding!)
    const { container, getByTestId } = render(
      <EmbeddingShowcaseView input={adapter.renderer} onSelect={() => undefined} />,
    )
    expect(getByTestId('embedding-showcase-view')).toBeDefined()
    expect(getByTestId('embedding-scatter')).toBeDefined()
    expect(getByTestId('embedding-offline-disclosure')).toBeDefined()
    expect(container).toMatchSnapshot()
  })
})

describe('SemanticNetworkShowcaseView — W0-03 DOM snapshot baseline', () => {
  it('renders the pinned intro fixture with the expected distribution cards', () => {
    const dataset = introDataset()
    expect(dataset.semanticNetwork, 'intro semantic-network payload missing').toBeDefined()
    const adapter = adaptSemanticNetworkFixture(dataset.semanticNetwork!)
    const { container, getByTestId } = render(
      <SemanticNetworkShowcaseView
        input={adapter.renderer}
        distribution={adapter.distribution}
        onSelect={() => undefined}
      />,
    )
    expect(getByTestId('semantic-network-showcase-view')).toBeDefined()
    expect(getByTestId('sn-node-types')).toBeDefined()
    expect(getByTestId('sn-edge-types')).toBeDefined()
    expect(container).toMatchSnapshot()
  })
})