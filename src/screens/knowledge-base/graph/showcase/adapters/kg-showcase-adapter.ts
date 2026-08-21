/**
 * Knowledge-Graph showcase adapter.
 *
 * Maps a `ShowcaseKgFixture` (verbatim from the Semantica introductory
 * notebook) into the readonly Sigma renderer input. No live runtime coupling.
 */
import type {
  ShowcaseKgFixture,
  ShowcaseKgRendererInput,
  ShowcaseMetric,
  ShowcaseInspectorField,
  ShowcaseInspectorModel,
} from '../semantica-showcase-types'
import type { SigmaGraphReadonlyInput, SigmaGraphReadonlySelection } from '../../sigma-graph-readonly'

const ENTITY_TYPE_COLORS: Record<string, string> = {
  Organization: '#2563eb',
  Person: '#0ea5e9',
  default: '#64748b',
}

export interface KgShowcaseAdapterResult {
  readonlyInput: SigmaGraphReadonlyInput
  renderer: ShowcaseKgRendererInput
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
}

export function adaptKgFixture(
  fixture: ShowcaseKgFixture,
  selection?: SigmaGraphReadonlySelection,
): KgShowcaseAdapterResult {
  const nodeIds = new Set(fixture.entities.map((entity) => entity.id))
  const edges = fixture.relationships.filter(
    (relationship) => nodeIds.has(relationship.source) && nodeIds.has(relationship.target),
  )

  const entityTypes = new Map<string, number>()
  fixture.entities.forEach((entity) => {
    entityTypes.set(entity.type, (entityTypes.get(entity.type) ?? 0) + 1)
  })
  const relationshipTypes = new Map<string, number>()
  edges.forEach((relationship) => {
    relationshipTypes.set(relationship.type, (relationshipTypes.get(relationship.type) ?? 0) + 1)
  })

  const readonlyInput: SigmaGraphReadonlyInput = {
    nodes: fixture.entities.map((entity) => ({
      id: entity.id,
      label: entity.name,
      group: entity.type,
      color: ENTITY_TYPE_COLORS[entity.type] ?? ENTITY_TYPE_COLORS.default,
    })),
    edges: edges.map((rel) => ({
      id: rel.id,
      source: rel.source,
      target: rel.target,
      label: rel.type,
    })),
    selection: selection ?? null,
    ariaLabel: 'Showcase knowledge graph (Semantica introductory notebook sample)',
  }

  const metrics: ShowcaseMetric[] = [
    { label: 'Nodes', value: String(fixture.entities.length) },
    { label: 'Edges', value: String(edges.length) },
    {
      label: 'Entity types',
      value: String(entityTypes.size),
      hint: Array.from(entityTypes.entries())
        .map(([type, count]) => `${type} (${count})`)
        .join(', '),
    },
    {
      label: 'Relationship types',
      value: String(relationshipTypes.size),
      hint: Array.from(relationshipTypes.entries())
        .map(([type, count]) => `${type} (${count})`)
        .join(', '),
    },
  ]

  const inspector = buildInspector(fixture, edges, selection)

  return {
    readonlyInput,
    renderer: { model: { nodes: readonlyInput.nodes, edges: readonlyInput.edges }, inspector, metrics },
    inspector,
    metrics,
  }
}

function buildInspector(
  fixture: ShowcaseKgFixture,
  edges: ShowcaseKgFixture['relationships'],
  selection?: SigmaGraphReadonlySelection,
): ShowcaseInspectorModel {
  if (!selection) {
    return {
      title: 'No selection',
      emptyLabel: 'Click a node or edge to inspect',
      fields: [],
    }
  }
  if (selection.type === 'node') {
    const entity = fixture.entities.find((candidate) => candidate.id === selection.id)
    if (!entity) {
      return {
        title: 'Unknown node',
        emptyLabel: `Node "${selection.id}" is not in this fixture.`,
        fields: [],
      }
    }
    const fields: ShowcaseInspectorField[] = [
      { label: 'id', value: entity.id, mono: true },
      { label: 'type', value: entity.type },
      { label: 'name', value: entity.name },
    ]
    const outgoing = edges.filter((edge) => edge.source === entity.id)
    const incoming = edges.filter((edge) => edge.target === entity.id)
    if (outgoing.length) {
      fields.push({
        label: 'outgoing',
        value: outgoing
          .map((edge) => `${edge.type} → ${edge.target}`)
          .join('; '),
      })
    }
    if (incoming.length) {
      fields.push({
        label: 'incoming',
        value: incoming
          .map((edge) => `${edge.source} → ${edge.type}`)
          .join('; '),
      })
    }
    return {
      title: entity.name,
      subtitle: entity.type,
      emptyLabel: '',
      fields,
    }
  }
  const edge = edges.find((candidate) => candidate.id === selection.id)
  if (!edge) {
    return {
      title: 'Unknown edge',
      emptyLabel: `Edge "${selection.id}" is not in this fixture.`,
      fields: [],
    }
  }
  return {
    title: edge.type,
    subtitle: `${edge.source} → ${edge.target}`,
    emptyLabel: '',
    fields: [
      { label: 'id', value: edge.id, mono: true },
      { label: 'source', value: edge.source, mono: true },
      { label: 'target', value: edge.target, mono: true },
      { label: 'type', value: edge.type },
    ],
  }
}
