/**
 * Ontology showcase adapter.
 *
 * The Semantica `OntologyVisualizer.visualize_hierarchy` expects class hierarchy
 * data. We adapt the deterministic ontology fixture into a readonly view-model
 * that the ontology renderer can consume directly (no Sigma, no React Flow
 * dependency — see plan §9.2 implementation choice B).
 */
import type {
  ShowcaseMetric,
  ShowcaseInspectorField,
  ShowcaseInspectorModel,
  ShowcaseOntologyClass,
  ShowcaseOntologyFixture,
  ShowcaseOntologyRendererInput,
} from '../semantica-showcase-types'
import type { SigmaGraphReadonlyEdge, SigmaGraphReadonlyNode } from '../../sigma-graph-readonly'

export interface OntologyHierarchyNode {
  id: string
  label: string
  kind: ShowcaseOntologyClass['kind']
  parentId: string | null
  depth: number
  instanceCount: number
  childIds: string[]
}

export interface OntologyAdapterResult {
  renderer: ShowcaseOntologyRendererInput
  inspector: ShowcaseInspectorModel
  metrics: ShowcaseMetric[]
  hierarchy: OntologyHierarchyNode[]
  maxDepth: number
}

export function adaptOntologyFixture(
  fixture: ShowcaseOntologyFixture,
  selectedClassId?: string,
): OntologyAdapterResult {
  const byParent = new Map<string | null, string[]>()
  fixture.classes.forEach((cls) => {
    const list = byParent.get(cls.parent) ?? []
    list.push(cls.id)
    byParent.set(cls.parent, list)
  })

  const hierarchy: OntologyHierarchyNode[] = []
  const depthByClass = new Map<string, number>()
  const walk = (id: string, depth: number) => {
    const cls = fixture.classes.find((candidate) => candidate.id === id)
    if (!cls) return
    depthByClass.set(id, depth)
    const childIds = byParent.get(id) ?? []
    hierarchy.push({
      id,
      label: cls.label,
      kind: cls.kind,
      parentId: cls.parent,
      depth,
      instanceCount: cls.instanceCount,
      childIds,
    })
    childIds.forEach((childId) => walk(childId, depth + 1))
  }
  const roots = byParent.get(null) ?? []
  roots.forEach((rootId) => walk(rootId, 0))

  const maxDepth = Array.from(depthByClass.values()).reduce(
    (acc, depth) => Math.max(acc, depth),
    0,
  )

  const metrics: ShowcaseMetric[] = [
    { label: 'Classes', value: String(fixture.classes.length) },
    { label: 'Properties', value: String(fixture.properties.length) },
    { label: 'Hierarchy depth', value: String(maxDepth + 1) },
    { label: 'Roots', value: String(roots.length) },
  ]

  const inspector = buildInspector(fixture, selectedClassId)
  const positions = layoutHierarchyPositions(hierarchy)
  const nodes: SigmaGraphReadonlyNode[] = hierarchy.map((node) => ({
    id: node.id,
    label: node.label,
    group: node.kind,
    size: node.kind === 'root' ? 13 : 10,
    color: ontologyNodeColor(node.kind),
    x: positions[node.id]?.x,
    y: positions[node.id]?.y,
  }))
  const edges: SigmaGraphReadonlyEdge[] = hierarchy
    .filter((node) => node.parentId)
    .map((node) => ({
      id: `ontology:${node.parentId}->${node.id}`,
      source: node.parentId!,
      target: node.id,
      label: 'inherits',
      size: 1,
      color: '#b4b8be',
    }))

  return {
    renderer: {
      model: {
        nodes,
        edges,
      },
      positions,
      classes: fixture.classes,
      properties: fixture.properties,
      inspector,
      metrics,
    },
    inspector,
    metrics,
    hierarchy,
    maxDepth,
  }
}

function ontologyNodeColor(kind: ShowcaseOntologyClass['kind']): string {
  if (kind === 'root') return '#3f6f2f'
  if (kind === 'entity-type') return '#2f5d8f'
  return '#7f5f2f'
}

function layoutHierarchyPositions(
  hierarchy: OntologyHierarchyNode[],
): Record<string, { x: number; y: number }> {
  const byDepth = new Map<number, OntologyHierarchyNode[]>()
  for (const node of hierarchy) {
    const list = byDepth.get(node.depth) ?? []
    list.push(node)
    byDepth.set(node.depth, list)
  }
  const positions: Record<string, { x: number; y: number }> = {}
  for (const [depth, nodes] of byDepth.entries()) {
    const spread = nodes.length - 1
    nodes.forEach((node, index) => {
      const centered = spread === 0 ? 0 : index - spread / 2
      positions[node.id] = {
        x: centered * 1.8,
        y: depth * 1.7,
      }
    })
  }
  return positions
}

function buildInspector(
  fixture: ShowcaseOntologyFixture,
  selectedClassId?: string,
): ShowcaseInspectorModel {
  if (!selectedClassId) {
    return {
      title: 'No class selected',
      emptyLabel: 'Click a class to inspect',
      fields: [],
    }
  }
  const cls = fixture.classes.find((candidate) => candidate.id === selectedClassId)
  if (!cls) {
    return {
      title: 'Unknown class',
      emptyLabel: `Class "${selectedClassId}" is not in this fixture.`,
      fields: [],
    }
  }
  const properties = fixture.properties.filter((prop) => prop.domain === cls.id)
  const fields: ShowcaseInspectorField[] = [
    { label: 'id', value: cls.id, mono: true },
    { label: 'label', value: cls.label },
    { label: 'kind', value: cls.kind },
    { label: 'parent', value: cls.parent ?? '—', mono: true },
    { label: 'instance count', value: String(cls.instanceCount) },
  ]
  if (properties.length) {
    fields.push({
      label: 'properties',
      value: properties.map((prop) => `${prop.label}: ${prop.range}`).join('; '),
    })
  }
  return {
    title: cls.label,
    subtitle: `${cls.kind}${cls.parent ? ` · parent: ${cls.parent}` : ''}`,
    emptyLabel: '',
    fields,
  }
}
