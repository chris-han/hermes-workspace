import { describe, expect, it } from 'vitest'

import { getDataset, getDatasetRegistry, listDatasetIds } from '../semantica-showcase-dataset'

describe('semantica-showcase-dataset', () => {
  it('exposes a registry pinned to the expected Semantica commit', () => {
    const registry = getDatasetRegistry()
    expect(registry.version).toBe(1)
    expect(registry.semanticaCommit).toMatch(/^[0-9a-f]{40}$/)
    expect(registry.notebookSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(registry.datasets.length).toBeGreaterThan(0)
  })

  it('lists dataset ids that all resolve to checked-in bundles', () => {
    const ids = listDatasetIds()
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const bundle = getDataset(id)
      expect(bundle.manifest.fixtureSha256).toBe(bundle.manifest.manifestSha256)
      expect(bundle.kg.entities.length).toBeGreaterThan(0)
      expect(bundle.kg.relationships.length).toBeGreaterThan(0)
      expect(bundle.ontology.classes.length).toBeGreaterThan(0)
      expect(bundle.embedding.items.length).toBeGreaterThan(0)
      expect(bundle.semanticNetwork.nodes.length).toBeGreaterThan(0)
      expect(bundle.semanticNetwork.edges.length).toBeGreaterThan(0)
    }
  })

  it('produces stable dataset ids', () => {
    const first = listDatasetIds().join(',')
    const second = listDatasetIds().join(',')
    expect(first).toBe(second)
  })
})
