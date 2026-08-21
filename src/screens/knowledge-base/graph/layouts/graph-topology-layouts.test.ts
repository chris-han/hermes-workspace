import { describe, expect, it } from 'vitest'

import {
  computeGraphTopology,
  type GraphTopologyMode,
  type GraphTopologyInput,
} from './graph-topology-layouts'

describe('graph-topology-layouts', () => {
  const baseInput: GraphTopologyInput = {
    nodes: [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
      { id: 'C', label: 'C' },
      { id: 'D', label: 'D' },
    ],
    edges: [
      { id: 'AB', source: 'A', target: 'B' },
      { id: 'AC', source: 'A', target: 'C' },
      { id: 'BD', source: 'B', target: 'D' },
    ],
  }

  it('preserves fixture coordinates when they are complete and finite', () => {
    const fixtureInput: GraphTopologyInput = {
      nodes: [
        { id: 'A', label: 'A', x: 0, y: 0 },
        { id: 'B', label: 'B', x: 100, y: 50 },
        { id: 'C', label: 'C', x: 0, y: 120 },
        { id: 'D', label: 'D', x: 120, y: 120 },
      ],
      edges: baseInput.edges,
    }

    const result = computeGraphTopology(fixtureInput, 'layout', { selectedRootId: 'A' })
    expect(result.coordinateOrigin).toBe('fixture')
    expect(result.positions.get('A')).toMatchObject({ x: 0, y: 0 })
    expect(result.rootIds).toContain('A')
  })

  it('computes a deterministic hierarchical layer order for a rooted DAG', () => {
    const result = computeGraphTopology(baseInput, 'hierarchical', { selectedRootId: 'A' })
    expect(result.rootIds).toContain('A')
    expect(result.componentCount).toBeGreaterThanOrEqual(1)
    expect(result.positions.get('A')?.y).toBeLessThan(result.positions.get('B')?.y ?? 999)
    expect(result.positions.get('A')?.y).toBeLessThan(result.positions.get('C')?.y ?? 999)
  })

  it('uses the selected node as the radial root when available', () => {
    const result = computeGraphTopology(baseInput, 'radial', { selectedRootId: 'C' })
    expect(result.rootIds).toContain('C')
    expect(result.positions.get('C')).toMatchObject({ x: 0, y: 0 })
  })

  it('returns finite positions for the force-directed mode', () => {
    const result = computeGraphTopology(baseInput, 'force-directed', { selectedRootId: 'A' })
    for (const entry of result.positions.values()) {
      expect(Number.isFinite(entry.x)).toBe(true)
      expect(Number.isFinite(entry.y)).toBe(true)
    }
  })

  it('keeps force-directed layout deterministic for a seed and changes across seeds', () => {
    const runA1 = computeGraphTopology(baseInput, 'force-directed', {
      selectedRootId: 'A',
      seed: 'nudge-1',
    })
    const runA2 = computeGraphTopology(baseInput, 'force-directed', {
      selectedRootId: 'A',
      seed: 'nudge-1',
    })
    const runB = computeGraphTopology(baseInput, 'force-directed', {
      selectedRootId: 'A',
      seed: 'nudge-2',
    })

    expect(runA1.positionHash).toBe(runA2.positionHash)
    expect(runA1.positionHash).not.toBe(runB.positionHash)
  })

  it('supports a stable-order mode test for layout without mutating input', () => {
    const original = JSON.stringify(baseInput)
    const result = computeGraphTopology(baseInput, 'layout')
    expect(JSON.stringify(baseInput)).toBe(original)
    expect(result.positions.size).toBe(baseInput.nodes.length)
  })

  it('separates disconnected root trees in hierarchical mode', () => {
    const multiRootInput: GraphTopologyInput = {
      nodes: [
        { id: 'Entity', label: 'Entity' },
        { id: 'Company', label: 'Company' },
        { id: 'Person', label: 'Person' },
        { id: 'Relationship', label: 'Relationship' },
        { id: 'works_on', label: 'works_on' },
      ],
      edges: [
        { id: 'E-C', source: 'Entity', target: 'Company' },
        { id: 'E-P', source: 'Entity', target: 'Person' },
        { id: 'R-W', source: 'Relationship', target: 'works_on' },
      ],
    }

    const result = computeGraphTopology(multiRootInput, 'hierarchical')
    const entity = result.positions.get('Entity')
    const relationship = result.positions.get('Relationship')
    expect(entity).toBeDefined()
    expect(relationship).toBeDefined()
    expect(entity?.y).toBe(relationship?.y)
    expect(entity?.x).not.toBe(relationship?.x)
  })

  it('places every node on a deterministic circular layout', () => {
    const first = computeGraphTopology(baseInput, 'circular')
    const second = computeGraphTopology(baseInput, 'circular')
    expect(first.positions.size).toBe(baseInput.nodes.length)
    expect(first.positionHash).toBe(second.positionHash)
    expect(first.coordinateOrigin).toBe('computed')
  })

  it('clusters explicit node groups in communities mode', () => {
    const groupedInput: GraphTopologyInput = {
      nodes: [
        { id: 'A1', group: 'A' },
        { id: 'A2', group: 'A' },
        { id: 'B1', group: 'B' },
        { id: 'B2', group: 'B' },
      ],
      edges: [
        { id: 'A', source: 'A1', target: 'A2' },
        { id: 'B', source: 'B1', target: 'B2' },
      ],
    }
    const result = computeGraphTopology(groupedInput, 'communities')
    expect(result.positions.size).toBe(4)
    expect(result.rootIds).toHaveLength(2)
    expect(result.coordinateOrigin).toBe('computed')
  })
})
