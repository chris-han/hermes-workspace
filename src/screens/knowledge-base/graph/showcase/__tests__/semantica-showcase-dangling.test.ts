/**
 * Vitest: no dangling references in showcase fixtures or adapters.
 *
 * Every relationship must reference an entity that exists; every node id in
 * any adapter input must come from a real fixture; manifest sha256 must
 * match the on-disk manifest.
 */
import { describe, expect, it } from 'vitest'

import { adaptKgFixture } from '../adapters/kg-showcase-adapter'
import { adaptSemanticNetworkFixture } from '../adapters/semantic-network-showcase-adapter'
import { getDataset, listDatasetIds } from '../semantica-showcase-dataset'

describe('showcase dangling-reference guard', () => {
  it('every KG relationship references a real entity, in every dataset', () => {
    for (const id of listDatasetIds()) {
      const dataset = getDataset(id)
      const entityIds = new Set(dataset.kg.entities.map((entity) => entity.id))
      for (const rel of dataset.kg.relationships) {
        expect(entityIds.has(rel.source), `${id}: ${rel.id} source missing`).toBe(true)
        expect(entityIds.has(rel.target), `${id}: ${rel.id} target missing`).toBe(true)
      }
    }
  })

  it('every ontology property references a real class on both ends', () => {
    for (const id of listDatasetIds()) {
      const dataset = getDataset(id)
      const classIds = new Set(dataset.ontology.classes.map((cls) => cls.id))
      for (const prop of dataset.ontology.properties) {
        expect(classIds.has(prop.domain), `${id}: ${prop.id} domain missing`).toBe(true)
        expect(classIds.has(prop.range), `${id}: ${prop.id} range missing`).toBe(true)
      }
      for (const cls of dataset.ontology.classes) {
        if (cls.parent !== null) {
          expect(classIds.has(cls.parent), `${id}: ${cls.id} parent missing`).toBe(true)
        }
      }
    }
  })

  it('every semantic-network edge references a real node', () => {
    for (const id of listDatasetIds()) {
      const dataset = getDataset(id)
      const nodeIds = new Set(dataset.semanticNetwork.nodes.map((node) => node.id))
      for (const edge of dataset.semanticNetwork.edges) {
        expect(nodeIds.has(edge.source), `${id}: ${edge.id} source missing`).toBe(true)
        expect(nodeIds.has(edge.target), `${id}: ${edge.id} target missing`).toBe(true)
      }
    }
  })

  it('KG adapter drops relationships whose endpoints are not in the entity set', () => {
    const adapter = adaptKgFixture({
      entities: [
        { id: 'x', type: 'T', name: 'X', properties: {} },
      ],
      relationships: [
        { id: 'r1', source: 'x', target: 'missing', type: 'rel', properties: {} },
        { id: 'r2', source: 'missing', target: 'x', type: 'rel', properties: {} },
      ],
    })
    expect(adapter.readonlyInput.edges).toHaveLength(0)
    expect(adapter.metrics.find((m) => m.label === 'Edges')?.value).toBe('0')
  })

  it('semantic-network adapter drops edges whose endpoints are not in the node set', () => {
    const adapter = adaptSemanticNetworkFixture({
      nodes: [{ id: 'n1', label: 'A', type: 'Language' }],
      edges: [{ id: 'e1', source: 'n1', target: 'missing', label: 'writes' }],
    })
    expect(adapter.readonlyInput.edges).toHaveLength(0)
  })

  it('every checked-in manifest sha256 matches the recorded fixture sha256', () => {
    for (const id of listDatasetIds()) {
      const dataset = getDataset(id)
      expect(dataset.manifest.manifestSha256).toBe(dataset.manifest.fixtureSha256)
    }
  })
})
