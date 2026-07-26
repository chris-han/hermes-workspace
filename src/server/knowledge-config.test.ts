import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildKnowledgeDatasetGovernanceConfig,
  getKnowledgeBaseEffectiveRoot,
  readKnowledgeBaseConfig,
  resolveKnowledgeBaseConfig,
  writeKnowledgeContextPreference,
  writeKnowledgeBaseConfig,
} from './knowledge-config'

function makeWorkspaceRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

describe('knowledge-config workspace scoping', () => {
  const createdRoots: Array<string> = []
  const originalKnowledgeDir = process.env.KNOWLEDGE_DIR

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
    if (originalKnowledgeDir == null) {
      delete process.env.KNOWLEDGE_DIR
    } else {
      process.env.KNOWLEDGE_DIR = originalKnowledgeDir
    }
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

  it('projects primary dataset governance rows from active workspace context', () => {
    const governance = buildKnowledgeDatasetGovernanceConfig({
      organizationId: 'org_real',
      datasetType: 'REAL',
      activeDatasetVersionId: 'dsv_real',
    })

    expect(governance.activationResolverPolicyVersion).toBe(
      'knowledge_activation_resolver.v1',
    )
    expect(governance.resolvedActivationSetHash).toMatch(/^ui-/)
    expect(governance.rows).toHaveLength(1)
    expect(governance.rows[0]).toMatchObject({
      sourceKind: 'dataset',
      semanticTier: 'T4',
      effectiveAuthorityStatus: 'binding_effective',
      userContextControlLevel: 'none',
      queryContextToggleVisible: false,
      datasetUsageRole: 'primary_analytics',
      datasetType: 'REAL',
      datasetVersionId: 'dsv_real',
      locked: true,
    })
  })

  it('writes optional dataset preferences without mutating shared activation state', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-preference-')
    createdRoots.push(workspaceRoot)
    const context = {
      organizationId: 'org_demo',
      datasetType: 'REFERENCE',
      datasetKey: 'reference_notes',
    }

    const preference = writeKnowledgeContextPreference(workspaceRoot, context, {
      activationId: 'compat_org_demo_reference',
      preferenceScope: 'principal',
      retrievalEnabled: false,
      promptContextEnabled: false,
    })

    expect(preference).toMatchObject({
      activationId: 'compat_org_demo_reference',
      preferenceScope: 'principal',
      retrievalEnabled: false,
      promptContextEnabled: false,
      queryContextEnabled: true,
    })
    const preferencePath = path.join(
      workspaceRoot,
      '.hermes-workspace',
      'knowledge-context-preferences.json',
    )
    expect(JSON.parse(fs.readFileSync(preferencePath, 'utf-8'))).toHaveLength(1)
    expect(
      buildKnowledgeDatasetGovernanceConfig(context).rows[0],
    ).toMatchObject({
      effectiveAuthorityStatus: 'optional_context',
      locked: false,
      retrievalEnabled: true,
    })
  })

  it('rejects preference updates that try to mutate locked activation authority', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-preference-locked-')
    createdRoots.push(workspaceRoot)

    expect(() => {
      writeKnowledgeContextPreference(
        workspaceRoot,
        {
          organizationId: 'org_real',
          datasetType: 'REAL',
          activeDatasetVersionId: 'dsv_real',
        },
        {
          activationId: 'compat_org_real_primary_analytics',
          preferenceScope: 'principal',
          queryContextEnabled: false,
          // @ts-expect-error runtime validation rejects shared activation fields.
          activationStatus: 'inactive',
        },
      )
    }).toThrow(/shared activation|binding authority/)
  })
})
