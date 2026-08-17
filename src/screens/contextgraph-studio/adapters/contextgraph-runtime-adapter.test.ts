import { describe, expect, it } from 'vitest'

import {
  adaptContextGraphRuntimeProjection,
  createContextGraphRuntimeAdapter,
  fetchAndAdaptRuntimeProjection,
} from './contextgraph-runtime-adapter'

const baseRuntime = {
  schemaVersion: 'semantier.contextgraph.browser_projection.v1',
  graphRef: 'graph_v12',
  graphVersion: 'graph_v12',
  graphHash: 'sha256:abcd',
  authorityState: 'candidate' as const,
  semanticaCommit: 'abc123',
  providerRef: 'semantica',
  providerCommit: 'abc123',
  sourceAnchors: [],
}

describe('contextgraph runtime adapter', () => {
  it('maps browser projection v1 nodes to GraphViewModel.v2 nodes', () => {
    const transport = {
      ...baseRuntime,
      sourceAnchors: [
        {
          sourceRef: 'src_poc_sensitive_terms',
          sourceHash: 'sha256:01',
          locator: 'table:1/cell:1/0',
          quote: '大型企业',
        },
      ],
      nodes: [
        {
          id: 'rule-001',
          type: 'rule',
          content: '企业规模门槛',
          sourceAnchors: [],
        },
      ],
      edges: [],
    }

    const view = adaptContextGraphRuntimeProjection(transport)
    expect(view.schemaVersion).toBe('semantier.graph_view_model.v2')
    expect(view.graphRef).toBe('graph_v12')
    expect(view.candidateGraphId).toBe('graph_v12')
    expect(view.acceptedReleaseId).toBeNull()
    expect(view.nodes).toHaveLength(1)
    const [node] = view.nodes
    expect(node?.id).toBe('rule-001')
    expect(node?.semanticType).toBe('rule')
    expect(node?.label).toBe('企业规模门槛')
    expect(view.sourceAnchors).toHaveLength(1)
  })

  it('sets acceptedReleaseId for authoritative graphs and clears candidateGraphId', () => {
    const view = adaptContextGraphRuntimeProjection({
      ...baseRuntime,
      authorityState: 'authoritative',
    })
    expect(view.candidateGraphId).toBeNull()
    expect(view.acceptedReleaseId).toBe('graph_v12')
    expect(view.authorityState).toBe('authoritative')
  })

  it('preserves directed parallel/reverse edges without deduplication', () => {
    const transport = {
      ...baseRuntime,
      nodes: [
        { id: 'A', type: 'concept', content: 'A', sourceAnchors: [] },
        { id: 'B', type: 'concept', content: 'B', sourceAnchors: [] },
      ],
      edges: [
        {
          id: 'e_requires',
          familyId: 'f1',
          source: 'A',
          target: 'B',
          type: 'requires',
          weight: 1,
          properties: {},
        },
        {
          id: 'e_exception',
          familyId: 'f1',
          source: 'A',
          target: 'B',
          type: 'exception_of',
          weight: 1,
          properties: {},
        },
        {
          id: 'e_derived',
          familyId: 'f2',
          source: 'B',
          target: 'A',
          type: 'derived_from',
          weight: 1,
          properties: {},
        },
      ],
    }

    const view = adaptContextGraphRuntimeProjection(transport)
    expect(view.edges.map((edge) => edge.id)).toEqual([
      'e_requires',
      'e_exception',
      'e_derived',
    ])
    expect(view.edges.map((edge) => edge.relationshipType)).toEqual([
      'requires',
      'exception_of',
      'derived_from',
    ])
    expect(view.edges.map((edge) => `${edge.sourceId}->${edge.targetId}`)).toEqual([
      'A->B',
      'A->B',
      'B->A',
    ])
  })

  it('never fabricates EvidenceRefs from SourceAnchor values', () => {
    const transport = {
      ...baseRuntime,
      nodes: [
        {
          id: 'rule-001',
          type: 'rule',
          content: '企业规模门槛',
          sourceAnchors: [
            {
              sourceRef: 'src_poc_sensitive_terms',
              sourceHash: 'sha256:01',
              locator: 'table:1/cell:1/0',
              quote: '大型企业',
            },
          ],
        },
      ],
      edges: [],
    }
    const view = adaptContextGraphRuntimeProjection(transport)
    expect(view.nodes[0]?.evidenceRefs).toEqual([])
    expect(view.sourceEvidenceRefs).toEqual([])
  })

  it('rejects transport payloads that are missing required identity', () => {
    expect(() =>
      adaptContextGraphRuntimeProjection({ schemaVersion: 'wrong' }),
    ).toThrow()
  })

  it('exposes a non-throwing tryAdapt helper', () => {
    const adapter = createContextGraphRuntimeAdapter()
    const ok = adapter.tryAdapt({
      ...baseRuntime,
      nodes: [],
      edges: [],
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.viewModel.graphRef).toBe('graph_v12')
    }

    const bad = adapter.tryAdapt({ schemaVersion: 'wrong' })
    expect(bad.ok).toBe(false)
  })
})

describe('fetchAndAdaptRuntimeProjection', () => {
  it('returns ok with parsed GraphViewModel when transport is valid', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ ...baseRuntime, nodes: [], edges: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch

    const result = await fetchAndAdaptRuntimeProjection(fetchImpl)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.viewModel.graphRef).toBe('graph_v12')
    }
  })

  it('returns http_error when the server returns non-2xx', async () => {
    const fetchImpl = (async () =>
      new Response('upstream error', { status: 503 })) as unknown as typeof fetch

    const result = await fetchAndAdaptRuntimeProjection(fetchImpl)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('http_error')
  })

  it('returns invalid_transport when the body is not valid JSON', async () => {
    const fetchImpl = (async () =>
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch

    const result = await fetchAndAdaptRuntimeProjection(fetchImpl)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_transport')
  })

  it('returns invalid_transport when Zod validation fails', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ schemaVersion: 'wrong' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch

    const result = await fetchAndAdaptRuntimeProjection(fetchImpl)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_transport')
  })

  it('returns network_error when the fetch throws', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('network down')
    }) as unknown as typeof fetch

    const result = await fetchAndAdaptRuntimeProjection(fetchImpl)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('network_error')
  })
})