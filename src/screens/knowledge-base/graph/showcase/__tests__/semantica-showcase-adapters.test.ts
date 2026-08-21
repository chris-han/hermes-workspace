import { describe, expect, it } from 'vitest'

import { adaptKgFixture } from '../adapters/kg-showcase-adapter'
import { adaptOntologyFixture } from '../adapters/ontology-showcase-adapter'
import { adaptEmbeddingFixture } from '../adapters/embedding-showcase-adapter'
import { adaptSemanticNetworkFixture } from '../adapters/semantic-network-showcase-adapter'
import { getDataset, listDatasetIds } from '../semantica-showcase-dataset'
import type { ShowcaseKgFixture } from '../semantica-showcase-types'

describe('KG showcase adapter', () => {
  it('preserves upstream entity/relationship ids verbatim', () => {
    const dataset = getDataset(listDatasetIds()[0]!)
    const adapter = adaptKgFixture(dataset.kg)
    const entityIds = new Set(adapter.readonlyInput.nodes.map((n) => n.id))
    const edgeIds = new Set(adapter.readonlyInput.edges.map((e) => e.id))
    for (const entity of dataset.kg.entities) {
      expect(entityIds.has(entity.id)).toBe(true)
    }
    for (const rel of dataset.kg.relationships) {
      expect(edgeIds.has(rel.id)).toBe(true)
    }
  })

  it('drops dangling relationships referencing unknown nodes', () => {
    const dangling: ShowcaseKgFixture = {
      entities: [{ id: 'a', type: 'X', name: 'A', properties: {} }],
      relationships: [
        { id: 'r1', source: 'a', target: 'missing', type: 'rel', properties: {} },
      ],
    }
    const adapter = adaptKgFixture(dangling)
    expect(adapter.readonlyInput.edges).toHaveLength(0)
  })

  it('exposes deterministic inspector fields when a node is selected', () => {
    const dataset = getDataset(listDatasetIds()[0]!)
    const adapter = adaptKgFixture(dataset.kg, { type: 'node', id: 'e1' })
    expect(adapter.inspector.title).toBe('Apple Inc.')
    expect(adapter.inspector.fields.find((f) => f.label === 'id')?.value).toBe('e1')
  })
})

describe('Ontology showcase adapter', () => {
  it('computes deterministic hierarchy depth and properties', () => {
    const dataset = getDataset(listDatasetIds()[0]!)
    const adapter = adaptOntologyFixture(dataset.ontology)
    expect(adapter.maxDepth).toBeGreaterThan(0)
    expect(adapter.hierarchy.some((node) => node.id === 'class:Organization')).toBe(true)
  })

  it('builds an inspector entry for the selected class', () => {
    const dataset = getDataset(listDatasetIds()[0]!)
    const adapter = adaptOntologyFixture(dataset.ontology, 'class:Relationship:CEO_of')
    expect(adapter.inspector.title).toBe('CEO_of')
    expect(adapter.inspector.fields.some((f) => f.label === 'kind')).toBe(true)
  })
})

describe('Embedding showcase adapter', () => {
  it('exposes deterministic 2D coordinates for the three label texts', () => {
    const dataset = getDataset(listDatasetIds()[0]!)
    const adapter = adaptEmbeddingFixture(dataset.embedding)
    const labels = adapter.renderer.items.map((item) => item.label)
    expect(labels).toEqual(['Apple', 'Microsoft', 'Amazon'])
    adapter.renderer.items.forEach((item) => {
      expect(Number.isFinite(item.x)).toBe(true)
      expect(Number.isFinite(item.y)).toBe(true)
    })
  })

  it('reveals the offline disclosure provenance', () => {
    const dataset = getDataset(listDatasetIds()[0]!)
    const adapter = adaptEmbeddingFixture(dataset.embedding, 'emb-0')
    expect(
      adapter.inspector.fields.find((f) => f.label === 'provenance')?.value,
    ).toMatch(/frozen/i)
  })
})

describe('Semantic Network showcase adapter', () => {
  it('shows node-type distribution consistent with the fixture', () => {
    const dataset = getDataset(listDatasetIds()[0]!)
    const adapter = adaptSemanticNetworkFixture(dataset.semanticNetwork)
    const nodeTypeLabels = adapter.distribution.nodeTypes.map((t) => t.label).sort()
    expect(nodeTypeLabels).toEqual(['Concept', 'Language'])
  })
})
