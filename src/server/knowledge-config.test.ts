import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getKnowledgeBaseEffectiveRoot,
  governedPreferenceRouteForScope,
  readGovernedKnowledgeDatasetGovernance,
  readKnowledgeBaseConfig,
  resolveKnowledgeBaseConfig,
  writeKnowledgeBaseConfig,
} from './knowledge-config'

function makeWorkspaceRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

describe('knowledge-config workspace scoping', () => {
  const createdRoots: Array<string> = []
  const originalKnowledgeDir = process.env.KNOWLEDGE_DIR
  const originalFetch = globalThis.fetch

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
    if (originalKnowledgeDir == null) {
      delete process.env.KNOWLEDGE_DIR
    } else {
      process.env.KNOWLEDGE_DIR = originalKnowledgeDir
    }
    globalThis.fetch = originalFetch
  })

  it('defaults to workspace wiki when no workspace config exists', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-config-default-')
    createdRoots.push(workspaceRoot)

    expect(getKnowledgeBaseEffectiveRoot(workspaceRoot)).toBe(
      path.resolve(workspaceRoot, 'wiki'),
    )
  })

  it('stores config independently for each workspace', () => {
    const workspaceA = makeWorkspaceRoot('knowledge-config-a-')
    const workspaceB = makeWorkspaceRoot('knowledge-config-b-')
    createdRoots.push(workspaceA, workspaceB)

    writeKnowledgeBaseConfig(
      {
        source: {
          type: 'local',
          path: 'notes/wiki',
        },
      },
      workspaceA,
    )

    expect(readKnowledgeBaseConfig(workspaceA).source).toEqual({
      type: 'local',
      path: 'notes/wiki',
    })

    expect(readKnowledgeBaseConfig(workspaceB).source).toEqual({
      type: 'local',
      path: '',
    })

    expect(getKnowledgeBaseEffectiveRoot(workspaceA)).toBe(
      path.resolve(workspaceA, 'notes/wiki'),
    )
    expect(getKnowledgeBaseEffectiveRoot(workspaceB)).toBe(
      path.resolve(workspaceB, 'wiki'),
    )
  })

  it('uses workspace-local knowledge base for real company when config is blank', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-config-real-default-')
    createdRoots.push(workspaceRoot)

    expect(
      readKnowledgeBaseConfig(workspaceRoot, { datasetType: 'REAL' }).source,
    ).toEqual({
      type: 'local',
      path: path.join(workspaceRoot, 'wiki'),
    })
  })

  it('does not expose repo bootstrap source for real company workspaces', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-config-real-bootstrap-')
    createdRoots.push(workspaceRoot)
    const repoBootstrapPath = path.resolve(
      process.cwd(),
      '..',
      'bootstrap',
      'common_knowledge',
    )

    writeKnowledgeBaseConfig(
      {
        source: {
          type: 'local',
          path: repoBootstrapPath,
        },
      },
      workspaceRoot,
    )

    expect(
      readKnowledgeBaseConfig(workspaceRoot, { datasetType: 'REAL' }).source,
    ).toEqual({
      type: 'local',
      path: path.join(workspaceRoot, 'wiki'),
    })
  })

  it('preserves explicit legacy workspace knowledge-base path', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-config-legacy-')
    createdRoots.push(workspaceRoot)

    writeKnowledgeBaseConfig(
      {
        source: {
          type: 'local',
          path: 'knowledge-base',
        },
      },
      workspaceRoot,
    )

    const resolved = resolveKnowledgeBaseConfig(workspaceRoot)
    expect(resolved.configuredPath).toBe('knowledge-base')
    expect(resolved.effectiveRoot).toBe(
      path.resolve(workspaceRoot, 'knowledge-base'),
    )
    expect(resolved.usesWorkspaceDefault).toBe(false)
    expect(resolved.upstreamWikiPath).toBe(path.resolve(workspaceRoot, 'wiki'))
  })

  it('keeps unsafe absolute saved paths as metadata but uses workspace wiki effectively', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-config-unsafe-')
    createdRoots.push(workspaceRoot)
    const unsafe = path.join(os.tmpdir(), 'host-global-wiki')

    writeKnowledgeBaseConfig(
      {
        source: {
          type: 'local',
          path: unsafe,
        },
      },
      workspaceRoot,
    )

    const resolved = resolveKnowledgeBaseConfig(workspaceRoot)
    expect(resolved.configuredPath).toBe(unsafe)
    expect(resolved.effectiveRoot).toBe(path.resolve(workspaceRoot, 'wiki'))
    expect(resolved.upstreamWikiPath).toBe(path.resolve(workspaceRoot, 'wiki'))
    expect(resolved.usesWorkspaceDefault).toBe(true)
  })

  it('does not use host-global ~/wiki as an authenticated effective root', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-config-home-wiki-')
    createdRoots.push(workspaceRoot)

    writeKnowledgeBaseConfig(
      {
        source: {
          type: 'local',
          path: '~/wiki',
        },
      },
      workspaceRoot,
    )

    const resolved = resolveKnowledgeBaseConfig(workspaceRoot)
    expect(resolved.configuredPath).toBe('~/wiki')
    expect(resolved.effectiveRoot).toBe(path.resolve(workspaceRoot, 'wiki'))
    expect(resolved.effectiveRoot).not.toBe(path.resolve(os.homedir(), 'wiki'))
  })

  it('exposes configured path and effective root separately for UI', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-config-resolved-')
    createdRoots.push(workspaceRoot)

    const resolved = resolveKnowledgeBaseConfig(workspaceRoot)

    expect(resolved.configuredPath).toBe('')
    expect(resolved.effectiveRoot).toBe(path.resolve(workspaceRoot, 'wiki'))
    expect(resolved.effectiveRootLabel).toBe('wiki')
    expect(resolved.usesWorkspaceDefault).toBe(true)
  })

  it('projects dataset governance rows from governed activation resolver output', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          activation_set_snapshot_id: 'kass_1',
          activation_resolver_policy_version: 'knowledge_activation_resolver.v1',
          resolved_activation_set_hash: 'resolver_hash_1',
          sources: [
            {
              activation_id: 'ksa_real_primary',
              source_kind: 'dataset',
              semantic_tier: 'T4',
              effective_authority_status: 'binding_effective',
              user_context_control_level: 'none',
              retrieval_included: true,
              prompt_context_included: true,
              query_context_included: true,
              dataset_usage_role: 'primary_analytics',
              dataset_type: 'REAL',
              dataset_key: 'resolver_dataset_key',
              dataset_version_id: 'dsv_real',
              dataset_asset_version_id: 'dav_real',
            },
          ],
        }),
        { status: 200 },
      )

    const governance = await readGovernedKnowledgeDatasetGovernance(
      new Headers(),
    )

    expect(governance.activationResolverPolicyVersion).toBe(
      'knowledge_activation_resolver.v1',
    )
    expect(governance.resolvedActivationSetHash).toBe('resolver_hash_1')
    expect(governance.rows).toHaveLength(1)
    expect(governance.rows[0]).toMatchObject({
      activationId: 'ksa_real_primary',
      sourceKind: 'dataset',
      semanticTier: 'T4',
      effectiveAuthorityStatus: 'binding_effective',
      userContextControlLevel: 'none',
      queryContextToggleVisible: false,
      datasetUsageRole: 'primary_analytics',
      datasetType: 'REAL',
      datasetKey: 'resolver_dataset_key',
      datasetVersionId: 'dsv_real',
      locked: true,
    })
  })

  it('does not synthesize governed dataset rows when resolver output is empty', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          activation_set_snapshot_id: null,
          activation_resolver_policy_version: null,
          resolved_activation_set_hash: null,
          sources: [],
        }),
        { status: 200 },
      )

    const governance = await readGovernedKnowledgeDatasetGovernance(
      new Headers(),
    )

    expect(governance.rows).toEqual([])
    expect(governance.resolvedActivationSetHash).toBe(
      'governed_activation_snapshot_unavailable',
    )
  })

  it('routes context preference writes to governed Semantier endpoints', () => {
    expect(governedPreferenceRouteForScope('principal')).toBe(
      '/api/knowledge/preferences/principal',
    )
    expect(governedPreferenceRouteForScope('role')).toBe(
      '/api/knowledge/preferences/role',
    )
    expect(governedPreferenceRouteForScope('workspace_default')).toBe(
      '/api/knowledge/preferences/workspace-default',
    )
    expect(governedPreferenceRouteForScope(undefined)).toBe(
      '/api/knowledge/preferences/principal',
    )
  })
})
