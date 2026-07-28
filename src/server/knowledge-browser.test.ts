import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildEffectiveContextGraph,
  buildKnowledgeChatContext,
  buildNativeMetadataSummary,
  listKnowledgePages,
  readKnowledgePage,
} from './knowledge-browser'

describe('knowledge-browser workspace isolation', () => {
  const createdRoots: Array<string> = []

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('lists and reads pages from the active workspace wiki only', () => {
    const workspaceA = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-a-'))
    const workspaceB = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-b-'))
    createdRoots.push(workspaceA, workspaceB)

    const knowledgeA = path.join(workspaceA, 'wiki')
    fs.mkdirSync(knowledgeA, { recursive: true })
    fs.writeFileSync(
      path.join(knowledgeA, 'semantier.md'),
      [
        '---',
        'title: Semantier Methodology',
        'tags: [architecture, ontology]',
        '---',
        '',
        'Semantier is a semantic-tier driven operating model.',
      ].join('\n'),
      'utf-8',
    )

    expect(listKnowledgePages(workspaceA)).toHaveLength(1)
    expect(listKnowledgePages(workspaceB)).toHaveLength(0)

    const page = readKnowledgePage('semantier.md', workspaceA)
    expect(page.meta.title).toBe('Semantier Methodology')
    expect(page.content).toContain('semantic-tier driven')
  })

  it('builds chat context from selected, linked, backlink, and tagged wiki pages', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-chat-'))
    createdRoots.push(workspace)

    const knowledgeRoot = path.join(workspace, 'wiki', '招投标')
    fs.mkdirSync(knowledgeRoot, { recursive: true })
    fs.writeFileSync(
      path.join(knowledgeRoot, '中华人民共和国招标投标法.md'),
      [
        '---',
        'title: 中华人民共和国招标投标法',
        'tags: [招投标, 法律]',
        '---',
        '',
        '> Curation material only.',
        '',
        '# 中华人民共和国招标投标法',
        '本法用于规范招标投标活动。',
        'See [[实施条例]].',
      ].join('\n'),
      'utf-8',
    )
    fs.writeFileSync(
      path.join(knowledgeRoot, '实施条例.md'),
      [
        '---',
        'title: 实施条例',
        'tags: [招投标]',
        '---',
        '',
        '实施条例补充说明招标程序。',
      ].join('\n'),
      'utf-8',
    )
    fs.writeFileSync(
      path.join(knowledgeRoot, '相关案例.md'),
      [
        '---',
        'title: 相关案例',
        'tags: [案例]',
        '---',
        '',
        '案例引用 [[中华人民共和国招标投标法]]。',
      ].join('\n'),
      'utf-8',
    )
    fs.writeFileSync(
      path.join(knowledgeRoot, '同标签页面.md'),
      [
        '---',
        'title: 同标签页面',
        'tags: [法律]',
        '---',
        '',
        '同标签页面用于补充法律背景。',
      ].join('\n'),
      'utf-8',
    )

    const context = buildKnowledgeChatContext(
      '招投标/中华人民共和国招标投标法.md',
      workspace,
      undefined,
      { primaryMaxChars: 2000, relatedMaxChars: 800, totalMaxChars: 8000 },
    )

    expect(context.primaryPath).toBe('招投标/中华人民共和国招标投标法.md')
    expect(context.includedPaths).toContain('招投标/实施条例.md')
    expect(context.includedPaths).toContain('招投标/相关案例.md')
    expect(context.includedPaths).toContain('招投标/同标签页面.md')
    expect(context.systemMessage).toContain('do not re-extract source PDFs')
    expect(context.systemMessage).toContain('本法用于规范招标投标活动')
    expect(context.systemMessage).toContain('实施条例补充说明招标程序')
    expect(context.systemMessage).toContain('案例引用')
    expect(context.systemMessage).toContain('同标签页面用于补充法律背景')
    expect(context.systemMessage).not.toContain('Curation material only.')
  })

  it('blocks authoritative answers from curation-only pages pending governed promotion', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-auth-'))
    createdRoots.push(workspace)

    const knowledgeRoot = path.join(workspace, 'wiki', '招投标')
    fs.mkdirSync(knowledgeRoot, { recursive: true })
    fs.writeFileSync(
      path.join(knowledgeRoot, '中华人民共和国招标投标法.md'),
      [
        '# 中华人民共和国招标投标法.pdf',
        '',
        '> Curation material only. Governed promotion is required before authority use.',
        '> Authority level: curation_only',
        '> Authority use: prohibited_until_governed_promotion',
        '> Normalized artifact ref: artifacts/document_extraction/ef698189d9f9.json',
        '> Parser method: pdf_unextractable',
        '> Human curation justification: this ls law',
      ].join('\n'),
      'utf-8',
    )

    const context = buildKnowledgeChatContext(
      '招投标/中华人民共和国招标投标法.md',
      workspace,
    )

    expect(context.systemMessage).toContain(
      'Authority use: prohibited_until_governed_promotion',
    )
    expect(context.systemMessage).toContain(
      'Do not answer from this page, related context, or model prior knowledge as though it were authoritative.',
    )
    expect(context.systemMessage).toContain(
      'authority use is unavailable until governed promotion',
    )
    expect(context.systemMessage).not.toContain('Human curation justification')
  })

  it('builds effective context graph with dataset and execution gate nodes', () => {
    const graph = buildEffectiveContextGraph(
      {},
      {
        auditEntitled: true,
        datasetGovernance: {
          activationResolverPolicyVersion: 'knowledge_activation_resolver.v1',
          resolvedActivationSetHash: 'resolver_hash_1',
          rows: [
            {
              activationId: 'ksa_demo_primary',
              sourceKind: 'dataset',
              semanticTier: 'T4',
              lifecycleStatus: 'approved',
              effectiveAuthorityStatus: 'binding_effective',
              userContextControlLevel: 'none',
              retrievalToggleVisible: false,
              promptContextToggleVisible: false,
              queryContextToggleVisible: false,
              retrievalEnabled: true,
              promptContextEnabled: true,
              queryContextEnabled: true,
              datasetUsageRole: 'primary_analytics',
              datasetType: 'DEMO',
              datasetKey: 'seeded_demo',
              datasetVersionId: null,
              sourceVersionId: 'seeded_demo',
              lastActivationActor: 'Governed activation resolver',
              auditHash: 'resolver_hash_1',
              locked: true,
            },
          ],
        },
      },
    )

    expect(graph.activationResolverPolicyVersion).toBe(
      'knowledge_activation_resolver.v1',
    )
    expect(graph.resolvedActivationSetHash).toBe('resolver_hash_1')
    expect(graph.nodes.some((node) => node.nodeType === 'dataset_asset')).toBe(
      true,
    )
    expect(
      graph.edges.some((edge) => edge.edgeType === 'governs'),
    ).toBe(true)
    expect(graph.edges.some((edge) => edge.edgeType === 'pins')).toBe(true)
  })

  it('redacts resolver hashes and restricted dataset details for ordinary graph viewers', () => {
    const graph = buildEffectiveContextGraph({}, {
      datasetGovernance: {
        activationResolverPolicyVersion: 'knowledge_activation_resolver.v1',
        resolvedActivationSetHash: 'resolver_hash_1',
        rows: [
          {
            activationId: 'ksa_demo_primary',
            sourceKind: 'dataset',
            semanticTier: 'T4',
            lifecycleStatus: 'approved',
            effectiveAuthorityStatus: 'binding_effective',
            userContextControlLevel: 'none',
            retrievalToggleVisible: false,
            promptContextToggleVisible: false,
            queryContextToggleVisible: false,
            retrievalEnabled: true,
            promptContextEnabled: true,
            queryContextEnabled: true,
            datasetUsageRole: 'primary_analytics',
            datasetType: 'DEMO',
            datasetKey: 'seeded_demo',
            datasetVersionId: null,
            sourceVersionId: 'seeded_demo',
            lastActivationActor: 'Governed activation resolver',
            auditHash: 'resolver_hash_1',
            locked: true,
          },
        ],
      },
    })

    expect(graph.activationResolverPolicyVersion).toBeNull()
    expect(graph.resolvedActivationSetHash).toBeNull()
    expect(graph.evidenceRef).toBe('opaque_activation_evidence')
    const datasetNode = graph.nodes.find((node) => {
      return node.nodeType === 'dataset_asset'
    })
    expect(datasetNode?.id).toBe('dataset_context_1')
    expect(datasetNode?.label).toBe('Governed dataset context active')
    expect(datasetNode?.label).not.toContain('seeded_demo')
    expect(datasetNode?.metadata).toMatchObject({
      sourceTier: null,
      effectiveAuthorityStatus: 'binding_effective',
      usageRole: null,
      contextControl: null,
      evidenceRef: 'opaque_context_evidence',
      datasetType: null,
    })
  })

  it('builds excluded effective context node when no dataset is active', () => {
    const graph = buildEffectiveContextGraph({})

    expect(
      graph.nodes.some((node) => node.nodeType === 'excluded_source'),
    ).toBe(true)
    expect(
      graph.edges.some((edge) => edge.edgeType === 'blocked_by_resolver'),
    ).toBe(true)
  })

  it('builds native metadata asset rows, lineage edges, and source anchors', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-ui-'))
    createdRoots.push(workspace)
    const knowledgeRoot = path.join(workspace, 'wiki')
    fs.mkdirSync(knowledgeRoot, { recursive: true })
    fs.writeFileSync(
      path.join(knowledgeRoot, 'policy.md'),
      [
        '---',
        'title: Policy Asset',
        'type: policy',
        'domain: tender',
        'status: curated',
        '---',
        '',
        'Policy page references [[dataset]].',
      ].join('\n'),
      'utf-8',
    )
    fs.writeFileSync(
      path.join(knowledgeRoot, 'dataset.md'),
      [
        '---',
        'title: Dataset Note',
        'type: dataset',
        '---',
        '',
        'Dataset note.',
      ].join('\n'),
      'utf-8',
    )

    const metadata = buildNativeMetadataSummary(
      workspace,
      {},
      {
        auditEntitled: true,
        datasetGovernance: {
          activationResolverPolicyVersion: 'knowledge_activation_resolver.v1',
          resolvedActivationSetHash: 'resolver_hash_1',
          rows: [
            {
              activationId: 'ksa_real_primary',
              sourceKind: 'dataset',
              semanticTier: 'T4',
              lifecycleStatus: 'approved',
              effectiveAuthorityStatus: 'binding_effective',
              userContextControlLevel: 'none',
              retrievalToggleVisible: false,
              promptContextToggleVisible: false,
              queryContextToggleVisible: false,
              retrievalEnabled: true,
              promptContextEnabled: true,
              queryContextEnabled: true,
              datasetUsageRole: 'primary_analytics',
              datasetType: 'REAL',
              datasetKey: 'finance_ledger',
              datasetVersionId: 'dsv_real',
              sourceVersionId: 'dsv_real',
              lastActivationActor: 'Governed activation resolver',
              auditHash: 'resolver_hash_1',
              locked: true,
            },
          ],
        },
      },
    )

    expect(metadata.resolverSnapshotHash).toBe('resolver_hash_1')
    expect(metadata.assetRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: 'dataset:ksa_real_primary',
          assetKind: 'dataset',
          metadataReadinessState: 'READY_METADATA_ONLY',
          runtimeAuthorityState: 'ACTIVE_AUTHORITY',
          locked: true,
        }),
        expect.objectContaining({
          assetId: 'wiki:policy.md',
          assetKind: 'wiki_document',
          runtimeAuthorityState: 'NOT_ACTIVE_AUTHORITY',
          sourceAnchors: expect.arrayContaining(['wiki/policy.md']),
        }),
      ]),
    )
    expect(metadata.lineageEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'dataset:ksa_real_primary',
          target: 'effective-context:resolver',
          relationType: 'governs',
        }),
        expect.objectContaining({
          source: 'wiki:policy.md',
          target: 'wiki:dataset.md',
          relationType: 'references',
        }),
      ]),
    )
    expect(metadata.sourceAnchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: 'wiki/policy.md',
          assetId: 'wiki:policy.md',
        }),
      ]),
    )
  })

  it('redacts evidence drawer hashes while preserving resolver graph parity', () => {
    const metadata = buildNativeMetadataSummary(
      undefined,
      {},
      {
        datasetGovernance: {
          activationResolverPolicyVersion: 'knowledge_activation_resolver.v1',
          resolvedActivationSetHash: 'resolver_hash_1',
          rows: [
            {
              activationId: 'ksa_demo_primary',
              sourceKind: 'dataset',
              semanticTier: 'T4',
              lifecycleStatus: 'approved',
              effectiveAuthorityStatus: 'binding_effective',
              userContextControlLevel: 'none',
              retrievalToggleVisible: false,
              promptContextToggleVisible: false,
              queryContextToggleVisible: false,
              retrievalEnabled: true,
              promptContextEnabled: true,
              queryContextEnabled: true,
              datasetUsageRole: 'primary_analytics',
              datasetType: 'DEMO',
              datasetKey: 'seeded_demo',
              datasetVersionId: null,
              sourceVersionId: 'seeded_demo',
              lastActivationActor: 'Governed activation resolver',
              auditHash: 'resolver_hash_1',
              locked: true,
            },
          ],
        },
      },
    )
    const graph = buildEffectiveContextGraph({}, {
      datasetGovernance: {
        activationResolverPolicyVersion: 'knowledge_activation_resolver.v1',
        resolvedActivationSetHash: 'resolver_hash_1',
        rows: [
          {
            activationId: 'ksa_demo_primary',
            sourceKind: 'dataset',
            semanticTier: 'T4',
            lifecycleStatus: 'approved',
            effectiveAuthorityStatus: 'binding_effective',
            userContextControlLevel: 'none',
            retrievalToggleVisible: false,
            promptContextToggleVisible: false,
            queryContextToggleVisible: false,
            retrievalEnabled: true,
            promptContextEnabled: true,
            queryContextEnabled: true,
            datasetUsageRole: 'primary_analytics',
            datasetType: 'DEMO',
            datasetKey: 'seeded_demo',
            datasetVersionId: null,
            sourceVersionId: 'seeded_demo',
            lastActivationActor: 'Governed activation resolver',
            auditHash: 'resolver_hash_1',
            locked: true,
          },
        ],
      },
    })

    expect(metadata.evidenceDrawer.redaction).toBe('redacted')
    expect(metadata.evidenceDrawer.rows[0]).toMatchObject({
      sourceHash: 'redacted_source_hash',
      snapshotHash: 'redacted_snapshot_hash',
      replayAuditRefs: [],
    })
    expect(metadata.resolverSnapshotHash).toBe('resolver_hash_1')
    expect(graph.evidenceRef).toBe('opaque_activation_evidence')
    expect(metadata.lineageEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'effective-context:resolver',
          relationType: 'governs',
        }),
      ]),
    )
  })
})
