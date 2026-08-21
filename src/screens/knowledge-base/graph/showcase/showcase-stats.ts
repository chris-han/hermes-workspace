/**
 * W6-06 statistics derivation.
 *
 * Every numeric value surfaced in the showcase left-rail / right-rail /
 * status-bar is derived from the active fixture; nothing is hand-authored.
 *
 * Renderer labels (layout name, renderer family, projection method) are
 * returned separately from statistics because they are intrinsic to the
 * visualization mode, not derived from data.
 */

import type {
  ShowcaseDatasetBundle,
  ShowcaseMetric,
  ShowcaseVisualizationMode,
} from './semantica-showcase-types'

export interface ShowcaseDatasetStats {
  /** Total typed entities in the KG payload (or 0 if unsupported). */
  entityCount: number
  /** Total typed relationships in the KG payload (or 0 if unsupported). */
  relationshipCount: number
  /** Total classes in the ontology payload (or 0 if unsupported). */
  classCount: number
  /** Hierarchy depth of the ontology (1 if unsupported or flat). */
  hierarchyDepth: number
  /** Total properties in the ontology payload (or 0 if unsupported). */
  propertyCount: number
  /** Total items in the embedding payload (or 0 if unsupported). */
  embeddingItemCount: number
  /** Embedding coordinate dimensions (2 or 3 if supported; 0 if unsupported). */
  embeddingDimensions: number
  /** Category breakdown for KG entity types. */
  entityTypeCounts: Array<{ label: string; count: number }>
  /** Category breakdown for ontology class kinds. */
  ontologyClassCounts: Array<{ label: string; count: number }>
}

export interface ShowcaseRendererLabels {
  layout: string
  renderer: string
  projection: string
}

const DEFAULT_LABELS: Record<ShowcaseVisualizationMode, ShowcaseRendererLabels> = {
  'knowledge-graph': {
    layout: 'circular (semantic intent)',
    renderer: 'Sigma/Graphology (readonly core)',
    projection: 'n/a',
  },
  ontology: {
    layout: 'hierarchical (parent-child)',
    renderer: 'tree',
    projection: 'n/a',
  },
  embedding: {
    layout: '2D scatter',
    renderer: 'svg',
    projection: 'deterministic hash',
  },
  'semantic-network': {
    layout: 'circular (semantic intent)',
    renderer: 'Sigma/Graphology (readonly core)',
    projection: 'n/a',
  },
}

/**
 * Derive all statistics from the active bundle. The function tolerates
 * missing payloads (per W4-03 — lens fields are optional); unsupported
 * dimensions are zero.
 */
export function deriveShowcaseStats(
  bundle: ShowcaseDatasetBundle,
): ShowcaseDatasetStats {
  const entityTypeCountsMap = new Map<string, number>()
  for (const entity of bundle.kg?.entities ?? []) {
    entityTypeCountsMap.set(
      entity.type,
      (entityTypeCountsMap.get(entity.type) ?? 0) + 1,
    )
  }
  const ontologyClassCountsMap = new Map<string, number>()
  for (const cls of bundle.ontology?.classes ?? []) {
    ontologyClassCountsMap.set(
      cls.kind,
      (ontologyClassCountsMap.get(cls.kind) ?? 0) + 1,
    )
  }

  // Hierarchy depth = max parent-chain length. For a tree with a single root,
  // depth is 1; for the demo ontology (Entity + Organization/Person +
  // Relationship + CEO_of), depth is 3.
  const classes = bundle.ontology?.classes ?? []
  const childParent = new Map(classes.map((c) => [c.id, c.parent]))
  let hierarchyDepth = 0
  for (const cls of classes) {
    let depth = 1
    let cursor: string | null = cls.parent
    const seen = new Set<string>()
    while (cursor !== null && !seen.has(cursor)) {
      depth += 1
      seen.add(cursor)
      cursor = childParent.get(cursor) ?? null
    }
    hierarchyDepth = Math.max(hierarchyDepth, depth)
  }

  // Embedding dimensions: every item has both x and y; a 3D embedding would
  // also have z. The current synthetic projection is 2D; flag 3D explicitly
  // if any item has a non-zero z that we trust (Semantica's EmbeddingFixture
  // type only carries x/y so this is always 2 for now).
  const embeddingItemCount = bundle.embedding?.items.length ?? 0
  const embeddingDimensions = embeddingItemCount > 0 ? 2 : 0

  return {
    entityCount: bundle.kg?.entities.length ?? 0,
    relationshipCount: bundle.kg?.relationships.length ?? 0,
    classCount: classes.length,
    hierarchyDepth: hierarchyDepth || 0,
    propertyCount: bundle.ontology?.properties.length ?? 0,
    embeddingItemCount,
    embeddingDimensions,
    entityTypeCounts: Array.from(entityTypeCountsMap, ([label, c]) => ({
      label,
      count: c,
    })).sort((a, b) => a.label.localeCompare(b.label)),
    ontologyClassCounts: Array.from(ontologyClassCountsMap, ([label, c]) => ({
      label,
      count: c,
    })).sort((a, b) => a.label.localeCompare(b.label)),
  }
}

export function rendererLabelsFor(
  mode: ShowcaseVisualizationMode,
  topology?: string,
): ShowcaseRendererLabels {
  const labels = DEFAULT_LABELS[mode]
  if (!topology || topology === 'layout') return labels
  return {
    ...labels,
    layout: topology,
  }
}

/**
 * Format the derived stats as `ShowcaseMetric[]` for the right-rail. Keeps
 * the existing test contract (the screen test asserts `Nodes`, `Edges`,
 * `Entity types` substrings).
 */
export function statsToMetrics(stats: ShowcaseDatasetStats): ShowcaseMetric[] {
  const metrics: ShowcaseMetric[] = []
  if (stats.entityCount > 0 || stats.relationshipCount > 0) {
    metrics.push(
      { label: 'Nodes', value: String(stats.entityCount) },
      { label: 'Edges', value: String(stats.relationshipCount) },
    )
  }
  if (stats.entityTypeCounts.length > 0) {
    metrics.push({
      label: 'Entity types',
      value: String(stats.entityTypeCounts.length),
    })
  }
  if (stats.classCount > 0) {
    metrics.push(
      { label: 'Classes', value: String(stats.classCount) },
      {
        label: 'Hierarchy depth',
        value: String(stats.hierarchyDepth),
        hint: 'parent-chain max',
      },
    )
  }
  if (stats.embeddingItemCount > 0) {
    metrics.push(
      { label: 'Embedding items', value: String(stats.embeddingItemCount) },
      {
        label: 'Dimensions',
        value: String(stats.embeddingDimensions),
        hint: '2D synthetic',
      },
    )
  }
  return metrics
}