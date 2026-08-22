import { describe, expect, it } from 'vitest'

import {
  getDataset,
  getDatasetRegistry,
  listDatasetIds,
  validateShowcaseRegistry,
  type ShowcaseKnownDatasets,
} from '../semantica-showcase-dataset'
import {
  SHOWCASE_ANALYTICS_SUBMODE_ORDER,
  SHOWCASE_LENS_ORDER,
  SHOWCASE_REGISTRY_VERSION,
  SHOWCASE_TEMPORAL_SUBMODE_ORDER,
  type ShowcaseDatasetRegistryEntry,
  type ShowcaseRegistry,
} from '../semantica-showcase-types'
import { resolveShowcaseState } from '../semantica-showcase-state'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Build a synthetic `known` map for one checked-in dataset bundle. */
function knownFor(datasetId: string): ShowcaseKnownDatasets {
  const bundle = getDataset(datasetId)
  const known: ShowcaseKnownDatasets[string] = { manifest: bundle.manifest }
  if (bundle.kg) known.kg = bundle.kg
  if (bundle.ontology) known.ontology = bundle.ontology
  if (bundle.embedding) known.embedding = bundle.embedding
  if (bundle.semanticNetwork) known.semanticNetwork = bundle.semanticNetwork
  if (bundle.temporal) known.temporal = bundle.temporal
  if (bundle.analytics) known.analytics = bundle.analytics
  return { [datasetId]: known }
}

function registryEntryFor(datasetId: string): ShowcaseDatasetRegistryEntry {
  const entry = getDatasetRegistry().datasets.find((item) => item.datasetId === datasetId)
  if (!entry) throw new Error(`missing registry entry for ${datasetId}`)
  return clone(entry)
}

function syntheticRegistry(
  version: number,
  entries: ShowcaseDatasetRegistryEntry[],
): ShowcaseRegistry {
  const base = getDatasetRegistry()
  return {
    version: version as ShowcaseRegistry['version'],
    generationToolVersion: base.generationToolVersion,
    semanticaCommit: base.semanticaCommit,
    datasets: entries,
    registrySha256: base.registrySha256,
  }
}

describe('semantica-showcase-dataset — checked-in v3 registry', () => {
  it('exposes a v3 registry pinned to a full Semantica commit sha', () => {
    const registry = getDatasetRegistry()
    expect(registry.version).toBe(SHOWCASE_REGISTRY_VERSION)
    expect(registry.version).toBe(3)
    expect(registry.semanticaCommit).toMatch(/^[0-9a-f]{40}$/)
    expect(registry.datasets.length).toBeGreaterThan(0)
  })

  it('lists dataset ids that all resolve, with payloads for every declared lens', () => {
    const ids = listDatasetIds()
    expect(ids.length).toBeGreaterThan(0)
    const registry = getDatasetRegistry()
    for (const id of ids) {
      const bundle = getDataset(id)
      const entry = registry.datasets.find((item) => item.datasetId === id)!
      for (const lens of entry.supportedLenses) {
        if (lens === 'knowledge-graph') {
          expect(bundle.kg, `${id}: kg payload missing`).toBeDefined()
          expect(bundle.kg!.entities.length, `${id}: kg entities empty`).toBeGreaterThan(0)
          expect(bundle.kg!.relationships.length, `${id}: kg relationships empty`).toBeGreaterThan(0)
        }
        if (lens === 'ontology') expect(bundle.ontology, `${id}: ontology payload missing`).toBeDefined()
        if (lens === 'embedding') expect(bundle.embedding, `${id}: embedding payload missing`).toBeDefined()
        if (lens === 'semantic-network') expect(bundle.semanticNetwork, `${id}: semantic-network payload missing`).toBeDefined()
        if (lens === 'temporal') expect(bundle.temporal, `${id}: temporal payload missing`).toBeDefined()
        if (lens === 'analytics') expect(bundle.analytics, `${id}: analytics payload missing`).toBeDefined()
      }
    }
  })

  it('validates the checked-in registry through the exported validator', () => {
    const registry = getDatasetRegistry()
    const known: ShowcaseKnownDatasets = {}
    for (const id of listDatasetIds()) {
      Object.assign(known, knownFor(id))
    }
    expect(() => validateShowcaseRegistry(clone(registry), known)).not.toThrow()
  })

  it('produces stable dataset ids', () => {
    expect(listDatasetIds().join(',')).toBe(listDatasetIds().join(','))
  })
})

describe('validateShowcaseRegistry — §4.1 migration contract', () => {
  it('accepts a frozen v2 registry entry without synthesizing six-lens support', () => {
    const entry = registryEntryFor('intro-cookbook-kg')
    expect(entry.supportedLenses).toEqual([
      'knowledge-graph',
      'ontology',
      'embedding',
      'semantic-network',
    ])
    expect(entry.supportedSubmodes).toBeUndefined()
    const v2 = syntheticRegistry(2, [entry])
    expect(() =>
      validateShowcaseRegistry(v2, knownFor('intro-cookbook-kg')),
    ).not.toThrow()
    // v2 stays the frozen four-lens contract: the entry is not upgraded.
    expect(entry.supportedLenses).not.toContain('temporal')
    expect(entry.supportedLenses).not.toContain('analytics')
  })

  it('rejects a v2 entry that wrongly declares temporal support', () => {
    const entry = registryEntryFor('knowledge-graph')
    entry.supportedLenses = ['knowledge-graph', 'temporal']
    expect(() =>
      validateShowcaseRegistry(syntheticRegistry(2, [entry]), knownFor('knowledge-graph')),
    ).toThrow(/supportedLenses/)
  })

  it.each([1, 4, 99])('fails closed on unsupported registry version %s', (version) => {
    const entry = registryEntryFor('knowledge-graph')
    expect(() =>
      validateShowcaseRegistry(syntheticRegistry(version, [entry]), knownFor('knowledge-graph')),
    ).toThrow(/Unsupported showcase registry version/)
  })
})

describe('validateShowcaseRegistry — §6.2 submode/payload invariants', () => {
  const DATASET = '03-Complete-Visualization-Suite'

  it('rejects an invalid submode name', () => {
    const entry = registryEntryFor(DATASET)
    entry.supportedSubmodes = {
      ...entry.supportedSubmodes,
      temporal: ['timeline', 'bogus' as never],
    }
    expect(() => validateShowcaseRegistry(syntheticRegistry(3, [entry]), knownFor(DATASET))).toThrow(
      /invalid temporal submode/,
    )
  })

  it('rejects duplicate submode declarations', () => {
    const entry = registryEntryFor(DATASET)
    entry.supportedSubmodes = {
      ...entry.supportedSubmodes,
      temporal: ['timeline', 'timeline', 'temporal-dashboard', 'network-evolution'],
    }
    expect(() => validateShowcaseRegistry(syntheticRegistry(3, [entry]), knownFor(DATASET))).toThrow(
      /duplicate submodes/,
    )
  })

  it('rejects a submode declared without its parent lens', () => {
    const entry = registryEntryFor(DATASET)
    // Synthetic bundle without the analytics payload: lenses kg+temporal.
    const known = knownFor(DATASET)
    delete known[DATASET]!.analytics
    entry.supportedLenses = ['knowledge-graph', 'temporal']
    entry.supportedSubmodes = {
      temporal: ['timeline', 'temporal-dashboard', 'network-evolution'],
      analytics: ['centrality'],
    }
    expect(() => validateShowcaseRegistry(syntheticRegistry(3, [entry]), known)).toThrow(
      /declares analytics submodes without supporting the analytics lens/,
    )
  })

  it('rejects a declared submode whose payload section is missing', () => {
    const entry = registryEntryFor(DATASET)
    const known = knownFor(DATASET)
    const temporal = clone(known[DATASET]!.temporal)!
    delete temporal.dashboard
    known[DATASET]!.temporal = temporal
    expect(() => validateShowcaseRegistry(syntheticRegistry(3, [entry]), known)).toThrow(
      /temporal submodes that do not match the payload sections/,
    )
  })

  it('rejects a supported top-level lens whose payload is missing', () => {
    const entry = registryEntryFor(DATASET)
    const known = knownFor(DATASET)
    delete known[DATASET]!.temporal
    expect(() => validateShowcaseRegistry(syntheticRegistry(3, [entry]), known)).toThrow(
      /supportedLenses.*do not match available payloads/,
    )
  })

  it('rejects an undeclared payload section as contract drift', () => {
    const entry = registryEntryFor(DATASET)
    entry.supportedSubmodes = {
      ...entry.supportedSubmodes,
      // dashboard section exists in the payload but is not declared.
      temporal: ['timeline', 'network-evolution'],
    }
    expect(() => validateShowcaseRegistry(syntheticRegistry(3, [entry]), knownFor(DATASET))).toThrow(
      /temporal submodes that do not match the payload sections/,
    )
  })

  it('rejects declared submode order that differs from the canonical §4.1.3 order', () => {
    const entry = registryEntryFor(DATASET)
    entry.supportedSubmodes = {
      ...entry.supportedSubmodes,
      temporal: ['network-evolution', 'timeline', 'temporal-dashboard'],
    }
    expect(() => validateShowcaseRegistry(syntheticRegistry(3, [entry]), knownFor(DATASET))).toThrow(
      /temporal submodes that do not match the payload sections/,
    )
  })
})

describe('resolveShowcaseState — §4.1.3 canonical fallback', () => {
  it('keeps the canonical orders in the types module as the single source', () => {
    expect([...SHOWCASE_LENS_ORDER]).toEqual([
      'knowledge-graph',
      'ontology',
      'embedding',
      'semantic-network',
      'temporal',
      'analytics',
    ])
    expect([...SHOWCASE_TEMPORAL_SUBMODE_ORDER]).toEqual([
      'timeline',
      'version-history',
      'temporal-dashboard',
      'network-evolution',
    ])
    expect([...SHOWCASE_ANALYTICS_SUBMODE_ORDER]).toEqual(['centrality', 'communities'])
  })

  it('preserves the requested lens/submode when the new dataset supports them', () => {
    const entry = registryEntryFor('03-Complete-Visualization-Suite')
    const resolved = resolveShowcaseState(entry, {
      lens: 'temporal',
      temporalSubmode: 'network-evolution',
      analyticsSubmode: 'communities',
    })
    expect(resolved.lens).toBe('temporal')
    expect(resolved.temporalSubmode).toBe('network-evolution')
    expect(resolved.analyticsSubmode).toBe('communities')
  })

  it('falls back to the first supported lens in canonical order when the lens is lost', () => {
    const kgOnly = registryEntryFor('knowledge-graph')
    const resolved = resolveShowcaseState(kgOnly, { lens: 'analytics', analyticsSubmode: 'communities' })
    expect(resolved.lens).toBe('knowledge-graph')
    expect(resolved.analyticsSubmode).toBeNull()
  })

  it('falls back to the first declared submode in canonical order when the submode is lost', () => {
    const entry = registryEntryFor('10-Temporal-Knowledge-Graphs')
    // version-history is not declared by 03, timeline is: switching 03 -> 10
    // while viewing temporal-dashboard must land on timeline.
    const resolved = resolveShowcaseState(entry, {
      lens: 'temporal',
      temporalSubmode: 'temporal-dashboard',
    })
    expect(resolved.lens).toBe('temporal')
    expect(resolved.temporalSubmode).toBe('timeline')
  })

  it('raises when a supported submode lens has no declared submode', () => {
    expect(() =>
      resolveShowcaseState({ supportedLenses: ['knowledge-graph', 'temporal'] }, { lens: 'temporal' }),
    ).toThrow(/declares no temporal submode/)
    expect(() =>
      resolveShowcaseState({ supportedLenses: ['analytics'] }, { lens: 'analytics' }),
    ).toThrow(/declares no analytics submode/)
  })
})
