import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildKnowledgeChatContext,
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
})
