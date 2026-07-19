import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { writeKnowledgeBaseConfig } from './knowledge-config'
import {
  KNOWLEDGE_UPLOAD_LIMITS,
  createKnowledgeDirectory,
  deleteKnowledgeFile,
  listKnowledgeDirectory,
  listKnowledgeTree,
  validateKnowledgeUploadLimits,
  writeKnowledgeUpload,
} from './knowledge-files'

function makeWorkspaceRoot(prefix: string): string {
  return fsSync.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function file(name: string, content: string | Uint8Array): File {
  return new File(
    [content instanceof Uint8Array ? (content.buffer as ArrayBuffer) : content],
    name,
  )
}

describe('knowledge-files workspace operations', () => {
  const createdRoots: Array<string> = []

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      fsSync.rmSync(root, { recursive: true, force: true })
    }
  })

  it('lists the workspace wiki by default', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-default-')
    createdRoots.push(workspaceRoot)
    fsSync.mkdirSync(path.join(workspaceRoot, 'wiki', 'raw'), {
      recursive: true,
    })
    fsSync.writeFileSync(
      path.join(workspaceRoot, 'wiki', 'index.md'),
      '# Index',
    )

    const listed = await listKnowledgeDirectory(workspaceRoot)

    expect(listed.effectiveRoot).toBe(path.join(workspaceRoot, 'wiki'))
    expect(listed.entries.map((entry) => entry.name)).toEqual([
      'raw',
      'index.md',
    ])
    expect(listed.directoryCount).toBe(1)
    expect(listed.fileCount).toBe(1)
  })

  it('uses explicit legacy workspace knowledge-base config', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-legacy-')
    createdRoots.push(workspaceRoot)
    writeKnowledgeBaseConfig(
      { source: { type: 'local', path: 'knowledge-base' } },
      workspaceRoot,
    )

    const listed = await listKnowledgeDirectory(workspaceRoot)

    expect(listed.effectiveRoot).toBe(
      path.join(workspaceRoot, 'knowledge-base'),
    )
    expect(listed.effectiveRootLabel).toBe('knowledge-base')
  })

  it('can force file operations to the workspace wiki root despite config', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-force-wiki-')
    createdRoots.push(workspaceRoot)
    writeKnowledgeBaseConfig(
      { source: { type: 'local', path: 'knowledge-base' } },
      workspaceRoot,
    )
    fsSync.mkdirSync(path.join(workspaceRoot, 'wiki', 'team'), {
      recursive: true,
    })
    fsSync.mkdirSync(path.join(workspaceRoot, 'knowledge-base', 'legacy'), {
      recursive: true,
    })

    const tree = await listKnowledgeTree(workspaceRoot, {
      forceWorkspaceWikiRoot: true,
    })
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      file('note.md', '# Note'),
      'team',
      { forceWorkspaceWikiRoot: true },
    )

    expect(tree.effectiveRoot).toBe(path.join(workspaceRoot, 'wiki'))
    expect(tree.root.children?.map((entry) => entry.name)).toEqual(['team'])
    expect(upload).toMatchObject({
      ok: true,
      kind: 'direct_write',
      path: 'team/note.md',
    })
    expect(
      fsSync.existsSync(path.join(workspaceRoot, 'wiki', 'team', 'note.md')),
    ).toBe(true)
    expect(
      fsSync.existsSync(
        path.join(workspaceRoot, 'knowledge-base', 'team', 'note.md'),
      ),
    ).toBe(false)
  })

  it('rejects traversal outside wiki root', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-traversal-')
    createdRoots.push(workspaceRoot)

    await expect(
      listKnowledgeDirectory(workspaceRoot, '../secret'),
    ).rejects.toThrow('Path is outside wiki root')
  })

  it('creates a sanitized subfolder under the selected wiki folder', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-create-folder-')
    createdRoots.push(workspaceRoot)

    await expect(
      createKnowledgeDirectory(workspaceRoot, null, ' Team Notes '),
    ).resolves.toEqual({
      ok: true,
      name: 'Team Notes',
      path: 'Team Notes',
    })
    await expect(
      createKnowledgeDirectory(workspaceRoot, 'Team Notes', '2026'),
    ).resolves.toEqual({
      ok: true,
      name: '2026',
      path: 'Team Notes/2026',
    })
    expect(
      fsSync
        .statSync(path.join(workspaceRoot, 'wiki', 'Team Notes', '2026'))
        .isDirectory(),
    ).toBe(true)
  })

  it('treats an existing knowledge folder as ready', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-existing-folder-')
    createdRoots.push(workspaceRoot)
    fsSync.mkdirSync(path.join(workspaceRoot, 'wiki', '招投标'), {
      recursive: true,
    })

    await expect(
      createKnowledgeDirectory(workspaceRoot, null, '招投标'),
    ).resolves.toEqual({
      ok: true,
      name: '招投标',
      path: '招投标',
    })
  })

  it('deletes a knowledge file inside the workspace wiki root', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-delete-file-')
    createdRoots.push(workspaceRoot)
    fsSync.mkdirSync(path.join(workspaceRoot, 'wiki', '招投标'), {
      recursive: true,
    })
    fsSync.writeFileSync(
      path.join(workspaceRoot, 'wiki', '招投标', 'source.pdf'),
      'pdf',
    )

    await expect(
      deleteKnowledgeFile(workspaceRoot, '招投标/source.pdf'),
    ).resolves.toEqual({
      ok: true,
      path: '招投标/source.pdf',
    })
    expect(
      fsSync.existsSync(
        path.join(workspaceRoot, 'wiki', '招投标', 'source.pdf'),
      ),
    ).toBe(false)
  })

  it('rejects deleting a knowledge directory through file delete', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-delete-dir-')
    createdRoots.push(workspaceRoot)
    fsSync.mkdirSync(path.join(workspaceRoot, 'wiki', '招投标'), {
      recursive: true,
    })

    await expect(deleteKnowledgeFile(workspaceRoot, '招投标')).rejects.toThrow(
      'Only files can be deleted here',
    )
  })

  it('sanitizes names and direct-writes text-like wiki sources', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-sanitize-')
    createdRoots.push(workspaceRoot)

    const result = await writeKnowledgeUpload(
      workspaceRoot,
      file('bad/name.md', '# Policy'),
    )

    expect(result).toMatchObject({
      ok: true,
      kind: 'direct_write',
      storedName: 'bad_name.md',
      path: 'bad_name.md',
      renamed: true,
    })
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', 'bad_name.md'),
        'utf-8',
      ),
    ).toBe('# Policy')
  })

  it('resolves duplicate uploads without overwriting', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-collision-')
    createdRoots.push(workspaceRoot)

    const first = await writeKnowledgeUpload(
      workspaceRoot,
      file('policy.md', 'one'),
    )
    const second = await writeKnowledgeUpload(
      workspaceRoot,
      file('policy.md', 'two'),
    )

    expect(first).toMatchObject({ ok: true, storedName: 'policy.md' })
    expect(second).toMatchObject({ ok: true, storedName: 'policy-2.md' })
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', 'policy.md'),
        'utf-8',
      ),
    ).toBe('one')
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', 'policy-2.md'),
        'utf-8',
      ),
    ).toBe('two')
  })

  it('handles concurrent duplicate writes with exclusive create semantics', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-concurrent-')
    createdRoots.push(workspaceRoot)

    const results = await Promise.all([
      writeKnowledgeUpload(workspaceRoot, file('policy.md', 'one')),
      writeKnowledgeUpload(workspaceRoot, file('policy.md', 'two')),
    ])

    const stored = results
      .map((result) => (result.ok ? result.storedName : ''))
      .sort()
    expect(stored).toEqual(['policy-2.md', 'policy.md'])
    expect(new Set(stored).size).toBe(2)
  })

  it('validates request count and size limits with one envelope', () => {
    expect(
      validateKnowledgeUploadLimits(
        Array.from({ length: 11 }, (_, index) => file(`f${index}.md`, 'x')),
      ),
    ).toMatchObject({
      ok: false,
      code: 'too_many_files',
      message: 'Too many files',
      scope: 'request',
    })

    expect(
      validateKnowledgeUploadLimits([
        file(
          'large.md',
          new Uint8Array(KNOWLEDGE_UPLOAD_LIMITS.maxDirectFileBytes + 1),
        ),
      ]),
    ).toMatchObject({
      ok: false,
      code: 'file_too_large',
      message: 'File too large',
      scope: 'file',
      filename: 'large.md',
    })

    expect(
      validateKnowledgeUploadLimits([
        file(
          'large.pdf',
          new Uint8Array(KNOWLEDGE_UPLOAD_LIMITS.maxParserFileBytes + 1),
        ),
      ]),
    ).toMatchObject({
      ok: false,
      code: 'file_too_large',
      scope: 'file',
      filename: 'large.pdf',
    })
  })

  it('stages parser-backed files and table uploads for review/import', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-stage-')
    createdRoots.push(workspaceRoot)

    await expect(
      writeKnowledgeUpload(workspaceRoot, file('doc.pdf', 'pdf'), '招投标'),
    ).resolves.toMatchObject({
      ok: true,
      kind: 'staged_for_ingest',
      storedName: 'doc.pdf',
      requiresIngest: true,
      ingestKind: 'document_extraction',
      canonicalArtifactKind: 'canonical_document',
      targetWikiPath: '招投标/doc.md',
    })
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', '招投标', 'doc.pdf'),
        'utf-8',
      ),
    ).toBe('pdf')

    await expect(
      writeKnowledgeUpload(workspaceRoot, file('sheet.xlsx', 'xlsx')),
    ).resolves.toMatchObject({
      ok: true,
      kind: 'staged_for_ingest',
      requiresIngest: true,
      ingestKind: 'table_ingestion',
      canonicalArtifactKind: 'canonical_table',
    })
  })

  it('direct-writes json unless parser extraction is explicitly requested', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-files-json-')
    createdRoots.push(workspaceRoot)

    await expect(
      writeKnowledgeUpload(workspaceRoot, file('facts.json', '{"a":1}')),
    ).resolves.toMatchObject({
      ok: true,
      kind: 'direct_write',
      path: 'facts.json',
    })
    await expect(
      writeKnowledgeUpload(workspaceRoot, file('facts.json', '{"a":1}'), null, {
        ingestMode: 'extract',
      }),
    ).resolves.toMatchObject({
      ok: true,
      kind: 'staged_for_ingest',
      ingestKind: 'document_extraction',
    })
  })
})
