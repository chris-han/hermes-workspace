/**
 * Semantica Showcase — Type contracts.
 *
 * The showcase data layer is a fully isolated, read-only data path. It mirrors
 * Semantica's upstream sample shapes inside the fixture layer rather than
 * coercing them into the live governed-projection or candidate-graph
 * contracts (which are not imported by this subtree on purpose).
 */

export type ShowcaseVisualizationMode =
  | 'knowledge-graph'
  | 'ontology'
  | 'embedding'
  | 'semantic-network'

export interface ShowcaseKgEntity {
  id: string
  type: string
  name: string
  properties: Record<string, unknown>
}

export interface ShowcaseKgRelationship {
  /** Semantica sample does not supply relationship IDs upstream; we derive them deterministically. */
  id: string
  source: string
  target: string
  type: string
  properties: Record<string, unknown>
}

export interface ShowcaseKgFixture {
  entities: ShowcaseKgEntity[]
  relationships: ShowcaseKgRelationship[]
}

export interface ShowcaseOntologyClass {
  id: string
  label: string
  kind: 'root' | 'entity-type' | 'relationship-type'
  parent: string | null
  instanceCount: number
}

export interface ShowcaseOntologyProperty {
  id: string
  label: string
  domain: string
  range: string
}

export interface ShowcaseOntologyFixture {
  classes: ShowcaseOntologyClass[]
  properties: ShowcaseOntologyProperty[]
}

export interface ShowcaseEmbeddingItem {
  id: string
  text: string
  label: string
  x: number
  y: number
}

export interface ShowcaseEmbeddingFixture {
  items: ShowcaseEmbeddingItem[]
}

export interface ShowcaseSemanticNetworkNode {
  id: string
  label: string
  type: string
}

export interface ShowcaseSemanticNetworkEdge {
  id: string
  source: string
  target: string
  label: string
}

export interface ShowcaseSemanticNetworkFixture {
  nodes: ShowcaseSemanticNetworkNode[]
  edges: ShowcaseSemanticNetworkEdge[]
}

export interface ShowcaseFixtureFileManifest {
  file: 'kg.json' | 'ontology.json' | 'embedding.json' | 'semantic-network.json'
  sha256: string
  derivationKind: 'verbatim' | 'generated-ontology' | 'embedding-projection'
  derivationParameters: Record<string, unknown>
}

export interface ShowcaseSourceCellDigest {
  file: ShowcaseFixtureFileManifest['file']
  cellIndex: number
  cellId: string | null
  cellSha256: string
}

export interface ShowcaseDatasetManifest {
  fixtureId: string
  semanticaCommit: string
  notebookPath: string
  notebookSha256: string
  sourceCells: ShowcaseSourceCellDigest[]
  derivationToolVersion: string
  files: ShowcaseFixtureFileManifest[]
  manifestSha256: string
  fixtureSha256: string
}

export interface ShowcaseDatasetBundle {
  datasetId: string
  displayName: string
  description: string
  manifest: ShowcaseDatasetManifest
  kg: ShowcaseKgFixture
  ontology: ShowcaseOntologyFixture
  embedding: ShowcaseEmbeddingFixture
  semanticNetwork: ShowcaseSemanticNetworkFixture
}

export interface ShowcaseRegistry {
  version: number
  generationToolVersion: string
  semanticaCommit: string
  notebookPath: string
  notebookSha256: string
  datasets: Array<{
    datasetId: string
    displayName: string
    description: string
    fixturePath: string
    manifestSha256: string
    files: Record<string, string>
  }>
  registrySha256: string
}

/* ---------- ShowcaseViewMeta / Inspector / Metric shared contracts ----------- */

export interface ShowcaseMetric {
  label: string
  value: string
  hint?: string
}

export interface ShowcaseInspectorField {
  label: string
  value: string
  mono?: boolean
}

export interface ShowcaseInspectorModel {
  title: string
  subtitle?: string
  fields: ShowcaseInspectorField[]
  emptyLabel: string
}

export interface ShowcaseViewMeta {
  mode: ShowcaseVisualizationMode
  title: string
  subtitle: string
  inventory: {
    label: string
    items: Array<{ label: string; hint?: string; count?: number }>
  }
  lowerSummary: Array<{ label: string; value: string }>
  metrics: ShowcaseMetric[]
  inspector: ShowcaseInspectorModel
  offlineBadge: string
  statusLine: string[]
}

/* ---------- Renderer input DTOs (renderer-core contract) --------------------- */

import type {
  SigmaGraphReadonlyEdge,
  SigmaGraphReadonlyNode,
} from '../sigma-graph-readonly'

/** Readonly renderer input shape shared by the KG and semantic-network renderers. */
export interface ShowcaseGraphModel {
  nodes: SigmaGraphReadonlyNode[]
  edges: SigmaGraphReadonlyEdge[]
}

/** Readonly renderer input for the KG renderer (the same input the live path feeds). */
export interface ShowcaseKgRendererInput {
  model: ShowcaseGraphModel
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
}

export interface ShowcaseEmbeddingRendererInput {
  items: ShowcaseEmbeddingItem[]
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
}

export interface ShowcaseSemanticNetworkRendererInput {
  model: ShowcaseGraphModel
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
}

export interface ShowcaseOntologyRendererInput {
  classes: ShowcaseOntologyClass[]
  properties: ShowcaseOntologyProperty[]
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
}

export type ShowcaseProvenanceBadge = {
  fixtureId: string
  semanticaCommit: string
  manifestSha256: string
  offline: true
  source: 'verbatim' | 'derived-deterministically'
}
