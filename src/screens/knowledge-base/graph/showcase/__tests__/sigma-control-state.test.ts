import { describe, expect, it } from 'vitest'

import { applySigmaModelControls, applySigmaPositionControls } from '../sigma-control-state'

describe('applySigmaModelControls', () => {
  it('appends node and edge properties when showProperties is enabled', () => {
    const model = {
      nodes: [
        { id: 'n1', label: 'Node', properties: { kind: 'entity', score: 7 } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n1', label: 'rel', properties: { weight: 0.8 } },
      ],
    }

    const controls = {
      direction: 'LR',
      focus: 'entire',
      dragMode: 'node',
      pinDrop: false,
      rotate: false,
      overlap: true,
      spacing: 50,
      gravity: 50,
      nodeSize: 'degree',
      nodeColor: 'semantic',
      edgeColor: 'semantic',
      edgeWidth: 50,
      nodeLabels: 'all',
      edgeLabels: 'all',
      showProperties: true,
      confidence: 0,
      barnesHut: false,
      edgeCurved: false,
      edgeArrows: true,
      scale: 50,
    } as const

    const result = applySigmaModelControls(model, null, controls)

    expect(result.nodes[0]?.label).toContain('kind=entity')
    expect(result.nodes[0]?.label).toContain('score=7')
    expect(result.edges[0]?.label).toContain('weight=0.8')
  })

  it('applies spacing and gravity to coordinates and supports rotate/pin-drop', () => {
    const positions = {
      a: { x: -1, y: 0 },
      b: { x: 1, y: 0 },
      c: { x: 0, y: 1 },
    }

    const baseControls = {
      direction: 'LR',
      focus: 'entire',
      dragMode: 'node',
      pinDrop: false,
      rotate: false,
      overlap: true,
      spacing: 50,
      gravity: 50,
      nodeSize: 'degree',
      nodeColor: 'semantic',
      edgeColor: 'semantic',
      edgeWidth: 50,
      nodeLabels: 'all',
      edgeLabels: 'all',
      showProperties: false,
      confidence: 0,
      barnesHut: false,
      edgeCurved: false,
      edgeArrows: true,
      scale: 50,
    } as const

    const compact = applySigmaPositionControls(positions, 'force-directed', {
      ...baseControls,
      spacing: 10,
      gravity: 90,
    })
    const spread = applySigmaPositionControls(positions, 'force-directed', {
      ...baseControls,
      spacing: 95,
      gravity: 10,
    })

    expect(Math.abs(spread.b.x)).toBeGreaterThan(Math.abs(compact.b.x))

    const rotated = applySigmaPositionControls(positions, 'force-directed', {
      ...baseControls,
      rotate: true,
      overlap: false,
    })
    expect(Math.abs(rotated.b.y)).toBeGreaterThan(0)

    const pinned = applySigmaPositionControls(
      positions,
      'force-directed',
      { ...baseControls, pinDrop: true, overlap: false },
      { type: 'node', id: 'b' },
    )
    expect(Math.abs(pinned.b.x)).toBeLessThan(1e-6)
    expect(Math.abs(pinned.b.y)).toBeLessThan(1e-6)
  })

  it('filters edges by confidence threshold', () => {
    const model = {
      nodes: [
        { id: 'n1', label: 'N1' },
        { id: 'n2', label: 'N2' },
        { id: 'n3', label: 'N3' },
      ],
      edges: [
        { id: 'e-high', source: 'n1', target: 'n2', label: 'high', properties: { confidence: 0.92 } },
        { id: 'e-low', source: 'n2', target: 'n3', label: 'low', properties: { confidence: 0.14 } },
      ],
    }

    const controls = {
      direction: 'LR',
      focus: 'entire',
      dragMode: 'node',
      pinDrop: false,
      rotate: false,
      overlap: true,
      spacing: 50,
      gravity: 50,
      nodeSize: 'degree',
      nodeColor: 'semantic',
      edgeColor: 'semantic',
      edgeWidth: 50,
      nodeLabels: 'all',
      edgeLabels: 'all',
      showProperties: false,
      confidence: 80,
      barnesHut: false,
      edgeCurved: false,
      edgeArrows: true,
      scale: 50,
    } as const

    const result = applySigmaModelControls(model, null, controls)

    expect(result.edges.map((edge) => edge.id)).toEqual(['e-high'])
  })
})