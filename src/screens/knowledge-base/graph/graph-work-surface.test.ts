import { describe, expect, it } from 'vitest'

import {
  fixtureGovernedGraphProjection,
  normalizeGovernedGraphProjection,
} from './graph-api-client'
import { buildDeterministicGraphLayout } from './graph-layout'
import { isAuthorityChangingBlocked, resolveGraphSelection } from './graph-selection'
import { filterGraphNodes } from './use-graph-search'

describe('Governed graph work surface logic', () => {
  it('searches visible nodes by title, source locator, authority role, and tier', () => {
    const projection = fixtureGovernedGraphProjection('evidence')
    const matches = filterGraphNodes(projection, {
      query: 'article 26',
      kind: 'all',
      tier: 'all',
      authorityRole: 'all',
      governanceState: 'all',
    })

    expect(matches.map((node) => node.id)).toEqual(['law:procurement:26'])
  })

  it('resolves selectable edge metadata as first-class inspector content', () => {
    const projection = fixtureGovernedGraphProjection('evidence')
    const selection = resolveGraphSelection(projection, {
      type: 'edge',
      id: 'edge:clause-assertion',
    })

    expect(selection).toMatchObject({
      predicate: 'supports_assertion',
      predicateLabel: 'supports finding',
      governanceState: 'candidate',
      capabilities: ['view', 'inspect_evidence'],
    })
  })

  it('blocks authority-changing actions for stale or failed freshness states', () => {
    expect(isAuthorityChangingBlocked('fresh')).toBe(false)
    expect(isAuthorityChangingBlocked('stale')).toBe(true)
    expect(isAuthorityChangingBlocked('indexing')).toBe(true)
    expect(isAuthorityChangingBlocked('failed_retryable')).toBe(true)
    expect(isAuthorityChangingBlocked('failed_terminal')).toBe(true)
  })

  it('keeps deterministic layout stable for the same scene input', () => {
    const projection = fixtureGovernedGraphProjection('evidence')
    const first = buildDeterministicGraphLayout(
      projection.nodes,
      projection.edges,
      projection.scenes[0],
    )
    const second = buildDeterministicGraphLayout(
      projection.nodes,
      projection.edges,
      projection.scenes[0],
    )

    expect(second).toEqual(first)
  })

  it('normalizes backend governed graph contract payloads into UI projection data', () => {
    const projection = normalizeGovernedGraphProjection({
      projection_id: 'projection:demo',
      as_of: '2026-07-30T00:00:00Z',
      authorization_context_ref: 'authz:workspace',
      graph_snapshot_ref: 'snapshot:abc',
      projection_hash: 'sha256:semantic',
      presentation_hash: 'sha256:presentation',
      freshness: {
        status: 'fresh',
        source_ref: 'source:demo',
        message: 'Ready',
      },
      redaction_manifest: {
        omitted_node_count: 2,
        omitted_edge_count: 1,
        minimized_node_count: 3,
      },
      warnings: [{ code: 'authorized_omission', message: 'Some data omitted' }],
      nodes: [
        {
          node_id: 'node:requirement',
          node_kind: 'claim',
          label: 'Requirement',
          display_summary: 'A governed requirement.',
          governance_state: 'active',
          semantic_tier: 'T4',
          authority_role: 'derived_interpretation',
          effective_from: '2026-07-01',
          source_anchor_refs: ['anchor:clause-4-2'],
          detail_ref: 'node:node:requirement',
          capabilities: ['view', 'trace_impact'],
          metadata: { canonical_key: 'Tender package 2026-A' },
        },
      ],
      edges: [
        {
          edge_id: 'edge:source-requirement',
          source_node_id: 'source:demo',
          target_node_id: 'node:requirement',
          predicate: 'SUPPORTS',
          predicate_label: 'supports',
          predicate_description: 'Source supports requirement',
          governance_state: 'active',
          semantic_tier: 'T4',
          authority_role: 'derived_interpretation',
          detail_ref: 'assertion:edge:source-requirement',
          capabilities: ['view'],
        },
      ],
      scenes: [
        {
          scene_id: 'scene:evidence',
          lens: 'evidence',
          title: 'Evidence',
          description: 'Evidence chain',
          layout_profile: 'evidence_chain',
          focus_node_id: 'node:requirement',
          node_ids: ['node:requirement'],
          edge_ids: ['edge:source-requirement'],
        },
      ],
    })

    expect(projection).toMatchObject({
      projectionId: 'projection:demo',
      asOf: '2026-07-30T00:00:00Z',
      authorizationContextRef: 'authz:workspace',
      graphSnapshotRef: 'snapshot:abc',
      semanticProjectionHash: 'sha256:semantic',
      presentationHash: 'sha256:presentation',
      freshness: {
        status: 'fresh',
        sourceRef: 'source:demo',
        message: 'Ready',
      },
      warnings: [{ code: 'authorized_omission', message: 'Some data omitted' }],
      omission: {
        hiddenNodeCount: 2,
        hiddenEdgeCount: 1,
        minimizedLabelCount: 3,
      },
    })
    expect(projection.nodes[0]).toMatchObject({
      id: 'node:requirement',
      summary: 'A governed requirement.',
      sourceLocator: 'anchor:clause-4-2',
      sourceTitle: 'Tender package 2026-A',
      capabilities: ['view', 'trace_impact'],
    })
    expect(projection.edges[0]).toMatchObject({
      id: 'edge:source-requirement',
      source: 'source:demo',
      target: 'node:requirement',
      predicateLabel: 'supports',
    })
    expect(projection.scenes[0]).toMatchObject({
      id: 'scene:evidence',
      focusNodeId: 'node:requirement',
    })
  })
})

describe('Governed graph JTBD UAT fixture coverage', () => {
  it('supports the ten phase-1 governed graph review scenarios', () => {
    const projection = fixtureGovernedGraphProjection('evidence')
    const byId = Object.fromEntries(projection.nodes.map((node) => [node.id, node]))
    const edgeById = Object.fromEntries(projection.edges.map((edge) => [edge.id, edge]))

    expect(byId['assertion:qualification']).toMatchObject({
      label: 'Qualification requirement',
      sourceLocator: 'Derived from clause 4.2',
      sourceHash: 'sha256:src_demo',
      localSpanHash: 'sha256:clause_4_2',
    })
    expect(edgeById['edge:clause-assertion']).toMatchObject({
      source: 'clause:4.2',
      target: 'assertion:qualification',
      predicateLabel: 'supports finding',
    })

    expect(edgeById['edge:assertion-authority']).toMatchObject({
      source: 'assertion:qualification',
      target: 'law:procurement:26',
      predicateLabel: 'constrained by',
    })
    expect(byId['law:procurement:26']).toMatchObject({
      authorityRole: 'binding_authority',
      governanceState: 'active',
    })

    expect(projection.conflicts[0]).toMatchObject({
      leftNodeId: 'assertion:qualification',
      rightNodeId: 'policy:internal:v3',
      status: 'unresolved',
      requiredApproverRoles: ['compliance_owner', 'legal_reviewer'],
    })

    expect(byId['assertion:qualification'].capabilities).toEqual(
      expect.arrayContaining(['validate', 'approve', 'reject']),
    )
    expect(byId['source:tender:demo'].capabilities).toContain(
      'request_source_correction',
    )

    expect(projection.impacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'Tender workflow',
          incomplete: true,
        }),
      ]),
    )

    expect(projection.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectRef: 'assertion:qualification',
          action: 'candidate_extracted',
          eventHash: 'sha256:event_extract',
        }),
      ]),
    )
    expect(byId['assertion:qualification'].capabilities).toContain(
      'export_evidence',
    )

    expect(projection.omission.hiddenNodeCount).toBeGreaterThan(0)
    expect(projection.omission.minimizedLabelCount).toBeGreaterThan(0)
    expect(projection.nodes.some((node) => node.id.includes('hidden'))).toBe(false)
    expect(projection.edges.some((edge) => edge.id.includes('hidden'))).toBe(false)

    expect(byId['policy:internal:v3']).toMatchObject({
      contextualOnly: true,
      governanceState: 'active',
      authorityRole: 'contextual_policy',
    })
  })
})
