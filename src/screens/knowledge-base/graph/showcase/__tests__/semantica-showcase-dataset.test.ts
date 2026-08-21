import { describe, expect, it } from 'vitest'

import { getDataset, getDatasetRegistry, listDatasetIds } from '../semantica-showcase-dataset'

describe('semantica-showcase-dataset', () => {
  it('exposes a registry pinned to the expected Semantica commit', () => {
    const registry = getDatasetRegistry()
    expect(registry.version).toBe(2)
    expect(registry.semanticaCommit).toMatch(/^[0-9a-f]{40}$/)
    expect(registry.datasets.length).toBeGreaterThan(0)
  })

  it('lists dataset ids that all resolve to checked-in bundles', () => {
    const ids = listDatasetIds()
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      const bundle = getDataset(id)
      expect(bundle.manifest.fixtureSha256).toBe(bundle.manifest.manifestSha256)
      // v2: lens fields are optional; the intro dataset has all four,
      // and any KG-only dataset still has at least kg populated.
      expect(bundle.kg, `${id}: kg payload missing`).toBeDefined()
      const kg = bundle.kg!
      expect(kg.entities.length).toBeGreaterThan(0)
      expect(kg.relationships.length).toBeGreaterThan(0)
    }
  })

  it('produces stable dataset ids', () => {
    const first = listDatasetIds().join(',')
    const second = listDatasetIds().join(',')
    expect(first).toBe(second)
  })
})
