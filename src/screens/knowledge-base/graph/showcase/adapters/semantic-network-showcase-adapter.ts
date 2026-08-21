/**
 * Semantic-Network showcase adapter.
 *
 * The upstream `SemanticNetworkVisualizer` accepts plain dictionary nodes and
 * edges with explicit `type` (e.g. Language, Concept). We adapt that sample
 * shape into the readonly Sigma renderer input plus a type-distribution
 * summary.
 */
import type {
  ShowcaseMetric,
  ShowcaseInspectorField,
  ShowcaseInspectorModel,
  ShowcaseSemanticNetworkFixture,
  ShowcaseSemanticNetworkRendererInput,
} from '../semantica-showcase-types'
import type {
  SigmaGraphReadonlyInput,
  SigmaGraphReadonlySelection,
} from '../../sigma-graph-readonly'

const NODE_TYPE_COLORS: Record<string, string> = {
  Language: '#7c3aed',
  Concept: '#10b981',
  default: '#64748b',
}

export interface SemanticNetworkAdapterResult {
  readonlyInput: SigmaGraphReadonlyInput
  renderer: ShowcaseSemanticNetworkRendererInput
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
  distribution: {
    nodeTypes: Array<{ label: string; count: number }>
    edgeTypes: Array<{ label: string; count: number }>
  }
}

export function adaptSemanticNetworkFixture(
  fixture: ShowcaseSemanticNetworkFixture,
  selection?: SigmaGraphReadonlySelection,
): SemanticNetworkAdapterResult {
  const nodeIds = new Set(fixture.nodes.map((node) => node.id))
  const edges = fixture.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  )

  const nodeTypes = new Map<string, number>()
  fixture.nodes.forEach((node) => {
    nodeTypes.set(node.type, (nodeTypes.get(node.type) ?? 0) + 1)
  })
  const edgeTypes = new Map<string, number>()
  edges.forEach((edge) => {
    edgeTypes.set(edge.label, (edgeTypes.get(edge.label) ?? 0) + 1)
  })

  const readonlyInput: SigmaGraphReadonlyInput = {
    nodes: fixture.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      group: node.type,
      color: NODE_TYPE_COLORS[node.type] ?? NODE_TYPE_COLORS.default,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
    })),
    selection: selection ?? null,
    ariaLabel: 'Showcase semantic network (Semantica introductory notebook sample)',
  }

  const metrics: ShowcaseMetric[] = [
    { label: 'Nodes', value: String(fixture.nodes.length) },
    { label: 'Edges', value: String(edges.length) },
    { label: 'Node types', value: String(nodeTypes.size) },
    { label: 'Edge types', value: String(edgeTypes.size) },
  ]

  const inspector = buildInspector(fixture, selection)

  return {
    readonlyInput,
    renderer: {
      model: { nodes: readonlyInput.nodes, edges: readonlyInput.edges },
      inspector,
      metrics,
    },
    inspector,
    metrics,
    distribution: {
      nodeTypes: Array.from(nodeTypes.entries()).map(([label, count]) => ({ label, count })),
      edgeTypes: Array.from(edgeTypes.entries()).map(([label, count]) => ({ label, count })),
    },
  }
}

function buildInspector(
  fixture: ShowcaseSemanticNetworkFixture,
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
    const node = fixture.nodes.find((candidate) => candidate.id === selection.id)
    if (!node) {
      return { title: 'Unknown node', emptyLabel: `Node "${selection.id}" not in this fixture.`, fields: [] }
    }
    const fields: ShowcaseInspectorField[] = [
      { label: 'id', value: node.id, mono: true },
      { label: 'label', value: node.label },
      { label: 'type', value: node.type },
    ]
    return { title: node.label, subtitle: node.type, emptyLabel: '', fields }
  }
  const edge = fixture.edges.find((candidate) => candidate.id === selection.id)
  if (!edge) {
    return { title: 'Unknown edge', emptyLabel: `Edge "${selection.id}" not in this fixture.`, fields: [] }
  }
  return {
    title: edge.label,
    subtitle: `${edge.source} → ${edge.target}`,
    emptyLabel: '',
    fields: [
      { label: 'id', value: edge.id, mono: true },
      { label: 'source', value: edge.source, mono: true },
      { label: 'target', value: edge.target, mono: true },
      { label: 'label', value: edge.label },
    ],
  }
}
