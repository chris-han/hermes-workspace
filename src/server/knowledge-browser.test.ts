import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { listKnowledgePages, readKnowledgePage } from './knowledge-browser'

describe('knowledge-browser workspace isolation', () => {
  const createdRoots: Array<string> = []

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('lists and reads pages from the active workspace knowledge-base only', () => {
    const workspaceA = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-a-'))
    const workspaceB = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-b-'))
    createdRoots.push(workspaceA, workspaceB)

    const knowledgeA = path.join(workspaceA, 'knowledge-base')
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
})
