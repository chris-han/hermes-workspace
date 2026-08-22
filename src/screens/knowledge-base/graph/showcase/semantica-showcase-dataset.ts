/**
 * Semantica showcase dataset loader.
 *
 * Loads checked-in dataset bundles + the dataset registry. This module is the
 * ONLY place where showcase fixtures are imported at runtime. It performs no
 * network calls and never parses upstream `.ipynb` files.
 *
 * Registry version policy: the loader accepts the frozen v2 registry and the
 * new v3 registry emitted by the notebook-parity expansion. Anything else is
 * rejected with a clear error so we never silently run against stale data.
 *
 * Consistency invariants (plan §W4-06): the loader fail-fasts on any of the
 * following:
 *   (a) registry entry manifest hash does not match the checked-in manifest
 *   (b) a `supportedLenses` entry has no matching manifest file + payload
 *   (c) a present payload hash does not match the manifest's `files[]`
 *   (d) registry/manifest Semantica commits disagree
 */

import {
  SHOWCASE_ANALYTICS_SUBMODE_ORDER,
  SHOWCASE_LENS_ORDER,
  SHOWCASE_REGISTRY_VERSION,
  SHOWCASE_TEMPORAL_SUBMODE_ORDER,
  type AnalyticsShowcaseSubmode,
  type ShowcaseDatasetBundle,
  type ShowcaseDatasetRegistryEntry,
  type ShowcaseDatasetManifest,
  type ShowcaseFixtureFileManifest,
  type ShowcaseRegistry,
  type ShowcaseTemporalFixture,
  type ShowcaseVisualizationMode,
  type TemporalShowcaseSubmode,
} from './semantica-showcase-types'
import registryJson from './datasets/dataset-registry.json' with { type: 'json' }
import introKg from './datasets/intro-cookbook-kg/kg.json' with { type: 'json' }
import introOntology from './datasets/intro-cookbook-kg/ontology.json' with { type: 'json' }
import introEmbedding from './datasets/intro-cookbook-kg/embedding.json' with { type: 'json' }
import introSemanticNetwork from './datasets/intro-cookbook-kg/semantic-network.json' with { type: 'json' }
import introManifest from './datasets/intro-cookbook-kg/manifest.json' with { type: 'json' }
import corporateOntology from './datasets/corporate-ontology/ontology.json' with { type: 'json' }
import corporateOntologyManifest from './datasets/corporate-ontology/manifest.json' with { type: 'json' }
import knowledgeGraphKg from './datasets/knowledge-graph/kg.json' with { type: 'json' }
import knowledgeGraphManifest from './datasets/knowledge-graph/manifest.json' with { type: 'json' }
import kg08YourFirst from './datasets/08-Your-First-Knowledge-Graph/kg.json' with { type: 'json' }
import kg08YourFirstManifest from './datasets/08-Your-First-Knowledge-Graph/manifest.json' with { type: 'json' }
import kg10GraphAnalytics from './datasets/10-Graph-Analytics/kg.json' with { type: 'json' }
import kg10GraphAnalyticsManifest from './datasets/10-Graph-Analytics/manifest.json' with { type: 'json' }
import kg02AdvGraphAnalytics from './datasets/02-Advanced-Graph-Analytics/kg.json' with { type: 'json' }
import kg02AdvGraphAnalyticsManifest from './datasets/02-Advanced-Graph-Analytics/manifest.json' with { type: 'json' }
import kg03CompleteVis from './datasets/03-Complete-Visualization-Suite/kg.json' with { type: 'json' }
import kg03CompleteVisTemporal from './datasets/03-Complete-Visualization-Suite/temporal.json' with { type: 'json' }
import kg03CompleteVisAnalytics from './datasets/03-Complete-Visualization-Suite/analytics.json' with { type: 'json' }
import kg03CompleteVisManifest from './datasets/03-Complete-Visualization-Suite/manifest.json' with { type: 'json' }
import kg05MultiFormat from './datasets/05-Multi-Format-Export/kg.json' with { type: 'json' }
import kg05MultiFormatManifest from './datasets/05-Multi-Format-Export/manifest.json' with { type: 'json' }
import kg08Reasoning from './datasets/08-Reasoning-and-Inference/kg.json' with { type: 'json' }
import kg08ReasoningManifest from './datasets/08-Reasoning-and-Inference/manifest.json' with { type: 'json' }
import kg09SemanticLayer from './datasets/09-Semantic-Layer-Construction/kg.json' with { type: 'json' }
import kg09SemanticLayerManifest from './datasets/09-Semantic-Layer-Construction/manifest.json' with { type: 'json' }
import kg10Temporal from './datasets/10-Temporal-Knowledge-Graphs/kg.json' with { type: 'json' }
import kg10TemporalTemporal from './datasets/10-Temporal-Knowledge-Graphs/temporal.json' with { type: 'json' }
import kg10TemporalManifest from './datasets/10-Temporal-Knowledge-Graphs/manifest.json' with { type: 'json' }
import kgAgnoGraphrag from './datasets/agno-graphrag-context/kg.json' with { type: 'json' }
import kgAgnoGraphragManifest from './datasets/agno-graphrag-context/manifest.json' with { type: 'json' }
import kg14Datalog from './datasets/14-Datalog-Style-Reasoning/kg.json' with { type: 'json' }
import kg14DatalogManifest from './datasets/14-Datalog-Style-Reasoning/manifest.json' with { type: 'json' }
import ont14 from './datasets/14-Ontology/ontology.json' with { type: 'json' }
import ont14Manifest from './datasets/14-Ontology/manifest.json' with { type: 'json' }
import ont13Manual from './datasets/13-Manual-Ontology-Snowflake-Mapping/ontology.json' with { type: 'json' }
import ont13ManualManifest from './datasets/13-Manual-Ontology-Snowflake-Mapping/manifest.json' with { type: 'json' }
import sn19 from './datasets/19-Context-Module/semantic-network.json' with { type: 'json' }
import sn19Manifest from './datasets/19-Context-Module/manifest.json' with { type: 'json' }
import sn11 from './datasets/11-Advanced-Context-Engineering/semantic-network.json' with { type: 'json' }
import sn11Manifest from './datasets/11-Advanced-Context-Engineering/manifest.json' with { type: 'json' }
import snAgnoMultiAgent from './datasets/agno-multi-agent-shared-context/semantic-network.json' with { type: 'json' }
import snAgnoMultiAgentManifest from './datasets/agno-multi-agent-shared-context/manifest.json' with { type: 'json' }

/** Payload sections keyed by lens, plus the checked-in manifest. */
export type ShowcaseKnownDatasets = Record<
  string,
  Pick<
    ShowcaseDatasetBundle,
    'kg' | 'ontology' | 'embedding' | 'semanticNetwork' | 'temporal' | 'analytics'
  > & { manifest: ShowcaseDatasetManifest }
>

const KNOWN_DATASETS: ShowcaseKnownDatasets = {
  'intro-cookbook-kg': {
    manifest: introManifest as unknown as ShowcaseDatasetManifest,
    kg: introKg as ShowcaseDatasetBundle['kg'],
    ontology: introOntology as ShowcaseDatasetBundle['ontology'],
    embedding: introEmbedding as ShowcaseDatasetBundle['embedding'],
    semanticNetwork: introSemanticNetwork as ShowcaseDatasetBundle['semanticNetwork'],
  },
  'corporate-ontology': {
    manifest: corporateOntologyManifest as unknown as ShowcaseDatasetManifest,
    ontology: corporateOntology as ShowcaseDatasetBundle['ontology'],
  },
  'knowledge-graph': {
    manifest: knowledgeGraphManifest as unknown as ShowcaseDatasetManifest,
    kg: knowledgeGraphKg as ShowcaseDatasetBundle['kg'],
  },
  '08-Your-First-Knowledge-Graph': {
    manifest: kg08YourFirstManifest as unknown as ShowcaseDatasetManifest,
    kg: kg08YourFirst as ShowcaseDatasetBundle['kg'],
  },
  '10-Graph-Analytics': {
    manifest: kg10GraphAnalyticsManifest as unknown as ShowcaseDatasetManifest,
    kg: kg10GraphAnalytics as ShowcaseDatasetBundle['kg'],
  },
  '14-Datalog-Style-Reasoning': {
    manifest: kg14DatalogManifest as unknown as ShowcaseDatasetManifest,
    kg: kg14Datalog as ShowcaseDatasetBundle['kg'],
  },
  '02-Advanced-Graph-Analytics': {
    manifest: kg02AdvGraphAnalyticsManifest as unknown as ShowcaseDatasetManifest,
    kg: kg02AdvGraphAnalytics as ShowcaseDatasetBundle['kg'],
  },
  '03-Complete-Visualization-Suite': {
    manifest: kg03CompleteVisManifest as unknown as ShowcaseDatasetManifest,
    kg: kg03CompleteVis as ShowcaseDatasetBundle['kg'],
    temporal: kg03CompleteVisTemporal as ShowcaseDatasetBundle['temporal'],
    analytics: kg03CompleteVisAnalytics as ShowcaseDatasetBundle['analytics'],
  },
  '05-Multi-Format-Export': {
    manifest: kg05MultiFormatManifest as unknown as ShowcaseDatasetManifest,
    kg: kg05MultiFormat as ShowcaseDatasetBundle['kg'],
  },
  '08-Reasoning-and-Inference': {
    manifest: kg08ReasoningManifest as unknown as ShowcaseDatasetManifest,
    kg: kg08Reasoning as ShowcaseDatasetBundle['kg'],
  },
  '09-Semantic-Layer-Construction': {
    manifest: kg09SemanticLayerManifest as unknown as ShowcaseDatasetManifest,
    kg: kg09SemanticLayer as ShowcaseDatasetBundle['kg'],
  },
  '10-Temporal-Knowledge-Graphs': {
    manifest: kg10TemporalManifest as unknown as ShowcaseDatasetManifest,
    kg: kg10Temporal as ShowcaseDatasetBundle['kg'],
    temporal: kg10TemporalTemporal as ShowcaseDatasetBundle['temporal'],
  },
  '14-Ontology': {
    manifest: ont14Manifest as unknown as ShowcaseDatasetManifest,
    ontology: ont14 as ShowcaseDatasetBundle['ontology'],
  },
  '13-Manual-Ontology-Snowflake-Mapping': {
    manifest: ont13ManualManifest as unknown as ShowcaseDatasetManifest,
    ontology: ont13Manual as ShowcaseDatasetBundle['ontology'],
  },
  '19-Context-Module': {
    manifest: sn19Manifest as unknown as ShowcaseDatasetManifest,
    semanticNetwork: sn19 as ShowcaseDatasetBundle['semanticNetwork'],
  },
  '11-Advanced-Context-Engineering': {
    manifest: sn11Manifest as unknown as ShowcaseDatasetManifest,
    semanticNetwork: sn11 as ShowcaseDatasetBundle['semanticNetwork'],
  },
  'agno-graphrag-context': {
    manifest: kgAgnoGraphragManifest as unknown as ShowcaseDatasetManifest,
    kg: kgAgnoGraphrag as ShowcaseDatasetBundle['kg'],
  },
  'agno-multi-agent-shared-context': {
    manifest: snAgnoMultiAgentManifest as unknown as ShowcaseDatasetManifest,
    semanticNetwork: snAgnoMultiAgent as ShowcaseDatasetBundle['semanticNetwork'],
  },
}

const REGISTRY = registryJson as unknown as ShowcaseRegistry

const LENS_TO_PAYLOAD_KEY: Record<ShowcaseVisualizationMode, keyof Pick<
  ShowcaseDatasetBundle,
  'kg' | 'ontology' | 'embedding' | 'semanticNetwork' | 'temporal' | 'analytics'
>> = {
  'knowledge-graph': 'kg',
  ontology: 'ontology',
  embedding: 'embedding',
  'semantic-network': 'semanticNetwork',
  temporal: 'temporal',
  analytics: 'analytics',
}

const LENS_TO_FILE: Record<ShowcaseVisualizationMode, ShowcaseFixtureFileManifest['file']> = {
  'knowledge-graph': 'kg.json',
  ontology: 'ontology.json',
  embedding: 'embedding.json',
  'semantic-network': 'semantic-network.json',
  temporal: 'temporal.json',
  analytics: 'analytics.json',
}

const ACCEPTED_REGISTRY_VERSIONS = new Set<number>([2, SHOWCASE_REGISTRY_VERSION])

const TEMPORAL_SUBMODE_TO_SECTION: Record<
  TemporalShowcaseSubmode,
  keyof ShowcaseTemporalFixture
> = {
  timeline: 'timeline',
  'version-history': 'versionHistory',
  'temporal-dashboard': 'dashboard',
  'network-evolution': 'networkEvolution',
}

const ANALYTICS_SUBMODE_TO_SECTION: Record<
  AnalyticsShowcaseSubmode,
  'centrality' | 'communities'
> = {
  centrality: 'centrality',
  communities: 'communities',
}

/**
 * §6.2 loader consistency invariants, extracted as a pure function so the
 * contract can be exercised against synthetic registries in tests (W2-07).
 * Throws on the first violation; module init calls this with the checked-in
 * registry and bundles.
 *
 * Canonical lens/submode capability is derived from the actually available
 * payloads (in §4.1.3 order); the registry declaration must match it exactly.
 * A v2 entry therefore can never be upgraded in memory into six-lens support:
 * declaring a lens/submode whose payload is absent fails closed.
 */
export function validateShowcaseRegistry(
  registry: ShowcaseRegistry,
  knownDatasets: ShowcaseKnownDatasets,
): void {
  // (registry-version invariant) accept the frozen v2 registry during the
  // migration window and the new v3 registry once generated.
  if (!ACCEPTED_REGISTRY_VERSIONS.has(registry.version)) {
    throw new Error(
      `Unsupported showcase registry version: ${registry.version} (expected 2 or ${SHOWCASE_REGISTRY_VERSION}).`,
    )
  }
  if (registry.datasets.length === 0) {
    throw new Error('Showcase registry contains zero datasets.')
  }
  const seenIds = new Set<string>()
  for (const entry of registry.datasets) {
    if (seenIds.has(entry.datasetId)) {
      throw new Error(
        `Duplicate dataset id in registry: "${entry.datasetId}".`,
      )
    }
    seenIds.add(entry.datasetId)

    const known = knownDatasets[entry.datasetId]
    if (!known) {
      throw new Error(
        `Registry references unknown dataset "${entry.datasetId}"; checked-in bundle missing.`,
      )
    }
    if (!Array.isArray(entry.supportedLenses) || entry.supportedLenses.length === 0) {
      throw new Error(
        `Registry entry "${entry.datasetId}" has empty supportedLenses.`,
      )
    }

    // §6.2(1): supportedLenses exactly matches available top-level payloads,
    // in the canonical §4.1.3 order.
    const canonicalSupportedLenses: ShowcaseVisualizationMode[] = []
    for (const lens of SHOWCASE_LENS_ORDER) {
      if (known[LENS_TO_PAYLOAD_KEY[lens]]) canonicalSupportedLenses.push(lens)
    }
    if (entry.supportedLenses.length !== canonicalSupportedLenses.length || entry.supportedLenses.some((lens, index) => lens !== canonicalSupportedLenses[index])) {
      throw new Error(
        `Registry supportedLenses for "${entry.datasetId}" do not match available payloads.`,
      )
    }

    const supportedSubmodes = entry.supportedSubmodes ?? {}
    const temporalSubmodes = supportedSubmodes.temporal ?? []
    const analyticsSubmodes = supportedSubmodes.analytics ?? []

    // §6.2(4): every declared submode is a valid versioned enum member.
    for (const submode of temporalSubmodes) {
      if (!(SHOWCASE_TEMPORAL_SUBMODE_ORDER as ReadonlyArray<string>).includes(submode)) {
        throw new Error(
          `Registry entry "${entry.datasetId}" declares invalid temporal submode "${submode}".`,
        )
      }
    }
    for (const submode of analyticsSubmodes) {
      if (!(SHOWCASE_ANALYTICS_SUBMODE_ORDER as ReadonlyArray<string>).includes(submode)) {
        throw new Error(
          `Registry entry "${entry.datasetId}" declares invalid analytics submode "${submode}".`,
        )
      }
    }

    // §6.2(6)/(9): declared-and-present submode sets, derived from payload
    // sections in canonical §4.1.3 order.
    const canonicalTemporalSubmodes: TemporalShowcaseSubmode[] = []
    if (known.temporal) {
      for (const submode of SHOWCASE_TEMPORAL_SUBMODE_ORDER) {
        if (known.temporal[TEMPORAL_SUBMODE_TO_SECTION[submode]]) canonicalTemporalSubmodes.push(submode)
      }
    }
    const canonicalAnalyticsSubmodes: AnalyticsShowcaseSubmode[] = []
    if (known.analytics) {
      for (const submode of SHOWCASE_ANALYTICS_SUBMODE_ORDER) {
        if (known.analytics[ANALYTICS_SUBMODE_TO_SECTION[submode]]) canonicalAnalyticsSubmodes.push(submode)
      }
    }

    // §6.2(3): a supportedSubmodes key requires the parent lens.
    if (temporalSubmodes.length > 0 && !entry.supportedLenses.includes('temporal')) {
      throw new Error(`Registry entry "${entry.datasetId}" declares temporal submodes without supporting the temporal lens.`)
    }
    if (analyticsSubmodes.length > 0 && !entry.supportedLenses.includes('analytics')) {
      throw new Error(`Registry entry "${entry.datasetId}" declares analytics submodes without supporting the analytics lens.`)
    }

    // §6.2(5): no duplicate submode declaration.
    const uniqueTemporal = Array.from(new Set(temporalSubmodes))
    const uniqueAnalytics = Array.from(new Set(analyticsSubmodes))
    if (uniqueTemporal.length !== temporalSubmodes.length || uniqueAnalytics.length !== analyticsSubmodes.length) {
      throw new Error(`Registry entry "${entry.datasetId}" declares duplicate submodes.`)
    }
    // §6.2(6)/(7)/(8): declared submodes match the present payload sections
    // exactly, in canonical order; undeclared payload sections are drift.
    if (temporalSubmodes.length !== canonicalTemporalSubmodes.length || temporalSubmodes.some((value, index) => value !== canonicalTemporalSubmodes[index])) {
      if (temporalSubmodes.length > 0 || canonicalTemporalSubmodes.length > 0) {
        throw new Error(`Registry entry "${entry.datasetId}" has temporal submodes that do not match the payload sections.`)
      }
    }
    if (analyticsSubmodes.length !== canonicalAnalyticsSubmodes.length || analyticsSubmodes.some((value, index) => value !== canonicalAnalyticsSubmodes[index])) {
      if (analyticsSubmodes.length > 0 || canonicalAnalyticsSubmodes.length > 0) {
        throw new Error(`Registry entry "${entry.datasetId}" has analytics submodes that do not match the payload sections.`)
      }
    }
    // (a) registry manifest hash matches the checked-in manifest
    if (known.manifest.manifestSha256 !== entry.manifestSha256) {
      throw new Error(
        `Registry manifestSha256 for "${entry.datasetId}" does not match checked-in bundle.`,
      )
    }
    // (d) registry and manifest Semantica commits agree
    if (known.manifest.semanticaCommit !== entry.semanticaCommit) {
      throw new Error(
        `Registry semanticaCommit for "${entry.datasetId}" disagrees with manifest.`,
      )
    }
    // (b)/(9) every supported lens has a matching manifest file + payload
    for (const lens of entry.supportedLenses) {
      const file = LENS_TO_FILE[lens]
      if (!known.manifest.files.some((f) => f.file === file)) {
        throw new Error(
          `Lens "${lens}" declared by "${entry.datasetId}" but missing from manifest.files[].`,
        )
      }
      const payloadKey = LENS_TO_PAYLOAD_KEY[lens]
      if (!(known as Record<string, unknown>)[payloadKey]) {
        throw new Error(
          `Lens "${lens}" declared by "${entry.datasetId}" but checked-in payload is missing.`,
        )
      }
    }
    // (c) every present manifest file's hash matches the registry's files[]
    for (const fileEntry of known.manifest.files) {
      const registeredHash = (entry as unknown as { files?: Record<string, string> })
        .files?.[fileEntry.file]
      if (registeredHash && registeredHash !== fileEntry.sha256) {
        throw new Error(
          `Registry files["${fileEntry.file}"] for "${entry.datasetId}" does not match manifest entry.`,
        )
      }
    }
  }
}

function ensureConsistency(): void {
  validateShowcaseRegistry(REGISTRY, KNOWN_DATASETS)
}

ensureConsistency()

export function getDatasetRegistry(): ShowcaseRegistry {
  return REGISTRY
}

export function listDatasetIds(): string[] {
  return REGISTRY.datasets.map((entry) => entry.datasetId)
}

export function getDataset(datasetId: string): ShowcaseDatasetBundle {
  const known = KNOWN_DATASETS[datasetId]
  if (!known) {
    throw new Error(`Unknown showcase dataset: ${datasetId}`)
  }
  const meta: ShowcaseDatasetRegistryEntry | undefined = REGISTRY.datasets.find(
    (entry) => entry.datasetId === datasetId,
  )
  if (!meta) {
    throw new Error(`Dataset not registered: ${datasetId}`)
  }
  return {
    datasetId,
    displayName: known.manifest.displayName,
    description: known.manifest.description,
    manifest: known.manifest,
    kg: known.kg,
    ontology: known.ontology,
    embedding: known.embedding,
    semanticNetwork: known.semanticNetwork,
    temporal: known.temporal,
    analytics: known.analytics,
  }
}
