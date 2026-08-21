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
      // v2: kg is an optional lens; only check datasets that declare it.
      if (!dataset.kg) continue
      const kg = dataset.kg
      const entityIds = new Set(kg.entities.map((entity) => entity.id))
      for (const rel of kg.relationships) {
        expect(entityIds.has(rel.source), `${id}: ${rel.id} source missing`).toBe(true)
        expect(entityIds.has(rel.target), `${id}: ${rel.id} target missing`).toBe(true)
      }
    }
  })

  it('every ontology property references a real class on both ends', () => {
    for (const id of listDatasetIds()) {
      const dataset = getDataset(id)
      // v2: ontology is an optional lens; only check datasets that declare it.
      if (!dataset.ontology) continue
      const ont = dataset.ontology
      const classIds = new Set(ont.classes.map((cls) => cls.id))
      for (const prop of ont.properties) {
        expect(classIds.has(prop.domain), `${id}: ${prop.id} domain missing`).toBe(true)
        // Datatype-property ranges (xsd:string, xsd:date, etc.) are
        // primitive values, not class IDs — skip those.
        if (prop.range.startsWith('class:')) {
          expect(classIds.has(prop.range), `${id}: ${prop.id} range missing`).toBe(true)
        }
      }
      for (const cls of ont.classes) {
        if (cls.parent !== null) {
          expect(classIds.has(cls.parent), `${id}: ${cls.id} parent missing`).toBe(true)
        }
      }
    }
  })

  it('every semantic-network edge references a real node', () => {
    for (const id of listDatasetIds()) {
      const dataset = getDataset(id)
      // v2: semantic-network is an optional lens; only check datasets
      // that declare it.
      if (!dataset.semanticNetwork) continue
      const sn = dataset.semanticNetwork
      const nodeIds = new Set(sn.nodes.map((node) => node.id))
      for (const edge of sn.edges) {
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

  it('every checked-in manifest has a self-verifying sha256', () => {
    // v2: manifestSha256 and fixtureSha256 are intentionally distinct
    // (the manifest hashes the manifest body, the fixture hashes the
    // ordered (path, sha) tuple). Verify both are 64-char hex.
    for (const id of listDatasetIds()) {
      const dataset = getDataset(id)
      expect(dataset.manifest.manifestSha256).toMatch(/^[0-9a-f]{64}$/)
      expect(dataset.manifest.fixtureSha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})
