import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  getKnowledgeBaseEffectiveRoot,
  readKnowledgeBaseConfig,
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

  it('defaults to workspace knowledge-base when no workspace config exists', () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-config-default-')
    createdRoots.push(workspaceRoot)

    expect(getKnowledgeBaseEffectiveRoot(workspaceRoot)).toBe(
      path.resolve(workspaceRoot, 'knowledge-base'),
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
      path.resolve(workspaceB, 'knowledge-base'),
    )
  })
})
