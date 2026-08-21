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

  return {
    renderer: {
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
