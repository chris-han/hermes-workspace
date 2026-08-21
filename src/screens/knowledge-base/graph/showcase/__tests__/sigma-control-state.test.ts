import { describe, expect, it } from 'vitest'

import { applySigmaModelControls } from '../sigma-control-state'

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
      spacing: 50,
      gravity: 50,
      nodeSize: 'degree',
      nodeColor: 'semantic',
      edgeColor: 'semantic',
      edgeWidth: 50,
      nodeLabels: 'all',
      edgeLabels: 'all',
      showProperties: true,
      edgeCurved: false,
      edgeArrows: true,
      scale: 50,
    } as const

    const result = applySigmaModelControls(model, null, controls)

    expect(result.nodes[0]?.label).toContain('kind=entity')
    expect(result.nodes[0]?.label).toContain('score=7')
    expect(result.edges[0]?.label).toContain('weight=0.8')
  })
})