// @vitest-environment jsdom

/**
 * W0-03 accessibility-tree snapshot baseline for the four renderers.
 *
 * These tests walk the accessible-name/role tree for each renderer driven by
 * the pinned intro fixture. They are intentionally separate from the DOM
 * snapshot tests so that a styling change does not silently break the
 * assistive-tech surface contract called out in plan §A7 (accessible line
 * tabs, bilingual copy).
 *
 * If the a11y tree changes, the change must be reviewed against the showcase
 * shell reference contract and §A6 (shared renderers).
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

import { cleanup, render, screen } from '@testing-library/react'

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

function rolesTree() {
  // Stable serialized shape of {role, name, depth} for every element with an
  // explicit role. Stable across DOM ordering because we sort by role+name.
  const elements = Array.from(document.querySelectorAll('[role], h1, h2, h3, h4, h5, h6, button, a, [data-testid]'))
  return elements
    .map((el) => ({
      role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
      name:
        el.getAttribute('aria-label') ??
        el.getAttribute('aria-labelledby') ??
        el.textContent?.trim().slice(0, 80) ??
        '',
      testid: el.getAttribute('data-testid') ?? '',
    }))
    .sort((a, b) =>
      a.role === b.role
        ? a.testid.localeCompare(b.testid)
        : a.role.localeCompare(b.role),
    )
}

describe('KgShowcaseView — W0-03 a11y tree baseline', () => {
  it('exposes a stable role/name/testid tree for the intro fixture', () => {
    const dataset = introDataset()
    expect(dataset.kg, 'intro kg payload missing').toBeDefined()
    const adapter = adaptKgFixture(dataset.kg!)
    render(<KgShowcaseView input={adapter.renderer} onSelect={() => undefined} />)
    const tree = rolesTree()
    expect(tree.length).toBeGreaterThan(0)
    expect(tree).toMatchSnapshot()
  })
})

describe('OntologyShowcaseView — W0-03 a11y tree baseline', () => {
  it('exposes a stable role=name tree with treeitem roles for classes', () => {
    const dataset = introDataset()
    expect(dataset.ontology, 'intro ontology payload missing').toBeDefined()
    const adapter = adaptOntologyFixture(dataset.ontology!)
    render(
      <OntologyShowcaseView
        input={adapter.renderer}
        hierarchy={adapter.hierarchy}
        maxDepth={adapter.maxDepth}
        onSelect={() => undefined}
      />,
    )
    const tree = rolesTree()
    expect(tree.some((n) => n.role === 'tree')).toBe(true)
    expect(tree.filter((n) => n.role === 'treeitem').length).toBeGreaterThan(0)
    expect(tree).toMatchSnapshot()
  })
})

describe('EmbeddingShowcaseView — W0-03 a11y tree baseline', () => {
  it('exposes a stable role/name tree with an img role for the scatter', () => {
    const dataset = introDataset()
    expect(dataset.embedding, 'intro embedding payload missing').toBeDefined()
    const adapter = adaptEmbeddingFixture(dataset.embedding!)
    render(<EmbeddingShowcaseView input={adapter.renderer} onSelect={() => undefined} />)
    const tree = rolesTree()
    expect(tree.some((n) => n.role === 'img')).toBe(true)
    expect(tree).toMatchSnapshot()
  })
})

describe('SemanticNetworkShowcaseView — W0-03 a11y tree baseline', () => {
  it('exposes a stable role/name tree for the readonly semantic-network canvas', () => {
    const dataset = introDataset()
    expect(dataset.semanticNetwork, 'intro semantic-network payload missing').toBeDefined()
    const adapter = adaptSemanticNetworkFixture(dataset.semanticNetwork!)
    render(
      <SemanticNetworkShowcaseView
        input={adapter.renderer}
        onSelect={() => undefined}
      />,
    )
      expect(screen.getByTestId('semantic-network-showcase-view')).toBeDefined()
    expect(rolesTree()).toMatchSnapshot()
  })
})