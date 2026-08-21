/**
 * Semantica showcase dataset loader.
 *
 * Loads checked-in dataset bundles + the dataset registry. This module is the
 * ONLY place where showcase fixtures are imported at runtime. It performs no
 * network calls and never parses upstream `.ipynb` files.
 */

import type {
  ShowcaseDatasetBundle,
  ShowcaseEmbeddingFixture,
  ShowcaseKgFixture,
  ShowcaseOntologyFixture,
  ShowcaseRegistry,
  ShowcaseSemanticNetworkFixture,
} from './semantica-showcase-types'
import registryJson from './datasets/dataset-registry.json' with { type: 'json' }
import introKg from './datasets/intro-cookbook-kg/kg.json' with { type: 'json' }
import introOntology from './datasets/intro-cookbook-kg/ontology.json' with { type: 'json' }
import introEmbedding from './datasets/intro-cookbook-kg/embedding.json' with { type: 'json' }
import introSemanticNetwork from './datasets/intro-cookbook-kg/semantic-network.json' with { type: 'json' }
import introManifest from './datasets/intro-cookbook-kg/manifest.json' with { type: 'json' }

const KNOWN_DATASETS = {
  'intro-cookbook-kg': {
    datasetId: 'intro-cookbook-kg',
    manifest: introManifest as ShowcaseDatasetBundle['manifest'],
    kg: introKg as ShowcaseKgFixture,
    ontology: introOntology as ShowcaseOntologyFixture,
    embedding: introEmbedding as ShowcaseEmbeddingFixture,
    semanticNetwork: introSemanticNetwork as ShowcaseSemanticNetworkFixture,
  },
} as const satisfies Record<
  string,
  Omit<ShowcaseDatasetBundle, 'displayName' | 'description'>
>

const REGISTRY = registryJson as ShowcaseRegistry

function ensureConsistency(): void {
  if (REGISTRY.version !== 1) {
    throw new Error(
      `Unsupported showcase registry version: ${REGISTRY.version}`,
    )
  }
  for (const entry of REGISTRY.datasets) {
    const known = (KNOWN_DATASETS as Record<string, unknown>)[entry.datasetId]
    if (!known) {
      throw new Error(
        `Registry references unknown dataset "${entry.datasetId}"; checked-in bundle missing.`,
      )
    }
    const knownManifest = (known as { manifest: { manifestSha256: string } }).manifest
    if (knownManifest.manifestSha256 !== entry.manifestSha256) {
      throw new Error(
        `Registry manifestSha256 for "${entry.datasetId}" does not match checked-in bundle.`,
      )
    }
  }
}

ensureConsistency()

export function getDatasetRegistry(): ShowcaseRegistry {
  return REGISTRY
}

export function listDatasetIds(): string[] {
  return REGISTRY.datasets.map((entry) => entry.datasetId)
}

export function getDataset(datasetId: string): ShowcaseDatasetBundle {
  const known = (KNOWN_DATASETS as Record<string, unknown>)[datasetId]
  if (!known) {
    throw new Error(`Unknown showcase dataset: ${datasetId}`)
  }
  const meta = REGISTRY.datasets.find((entry) => entry.datasetId === datasetId)
  if (!meta) {
    throw new Error(`Dataset not registered: ${datasetId}`)
  }
  const knownBundle = known as Omit<ShowcaseDatasetBundle, 'displayName' | 'description'>
  return {
    ...knownBundle,
    displayName: meta.displayName,
    description: meta.description,
  }
}
