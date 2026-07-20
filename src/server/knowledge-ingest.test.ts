import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestKnowledgeUpload } from './knowledge-ingest'
import { writeKnowledgeBaseConfig } from './knowledge-config'
import { writeKnowledgeUpload } from './knowledge-files'

function makeWorkspaceRoot(prefix: string): string {
  return fsSync.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function file(name: string, content: string): File {
  return new File([content], name)
}

function binaryFile(name: string, content: Uint8Array, type: string): File {
  return new File([content.buffer as ArrayBuffer], name, { type })
}

describe('knowledge-ingest governed import', () => {
  const createdRoots: Array<string> = []

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      fsSync.rmSync(root, { recursive: true, force: true })
    }
  })

  it('requires explicit confirmation before parser-backed import', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-confirm-')
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      file('source.pdf', 'pdf'),
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')

    await expect(
      ingestKnowledgeUpload(workspaceRoot, {
        uploadRef: upload.stagedUploadRef,
        confirmed: false,
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'confirmation_required',
    })
  })

  it('calls document extraction with governed refs and writes workspace-relative markdown', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-doc-')
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      file('source.pdf', 'pdf'),
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')
    const extractDocumentContent = vi.fn(async () => ({
      normalized_document_artifact_ref: 'canonical_document:v1:abc',
      source_hash: 'sha256:abc',
      parser: { method: 'document_extraction.local.v1' },
      text_blocks: [{ text: 'Extracted text' }],
      tables: [
        {
          rows: [
            ['A', 'B'],
            ['1', '2'],
          ],
        },
      ],
    }))

    const result = await ingestKnowledgeUpload(
      workspaceRoot,
      { uploadRef: upload.stagedUploadRef, confirmed: true },
      { extractDocumentContent },
    )

    expect(extractDocumentContent).toHaveBeenCalledWith(
      expect.objectContaining({
        document_ref: 'wiki/source.pdf',
        mode: 'live',
      }),
    )
    expect(result).toMatchObject({
      ok: true,
      status: 'parsed',
      storedMarkdownPath: 'raw/source.md',
      sourceFilePath: 'source.pdf',
      parserMethod: 'document_extraction.local.v1',
      normalizedDocumentArtifactRef: 'canonical_document:v1:abc',
      curationMaterial: true,
      governedPromotionRequired: true,
    })
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', 'raw', 'source.md'),
        'utf-8',
      ),
    ).toContain('Extracted text')
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', 'raw', 'source.md'),
        'utf-8',
      ),
    ).toContain('Authority level: curation_only')
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', 'raw', 'source.md'),
        'utf-8',
      ),
    ).toContain('Source file: wiki/source.pdf')
  })

  it('executes the installed document extraction plugin package for wiki imports', async () => {
    const workspaceRoot = makeWorkspaceRoot(
      'knowledge-ingest-installed-plugin-',
    )
    createdRoots.push(workspaceRoot)
    const pluginRoot = path.join(
      workspaceRoot,
      'plugins',
      'document_extraction',
    )
    fsSync.mkdirSync(pluginRoot, { recursive: true })
    fsSync.writeFileSync(path.join(pluginRoot, '__init__.py'), '', 'utf-8')
    fsSync.writeFileSync(
      path.join(pluginRoot, 'tools.py'),
      [
        'import json',
        '',
        'def extract_document_content(args, **_kw):',
        '    return json.dumps({',
        '        "status": "completed",',
        '        "document": {',
        '            "normalized_document_artifact_ref": "plugin-artifact:v1:installed",',
        '            "parser": {"method": "installed_document_extract_plugin"},',
        '            "text_blocks": [{"text": "Text from installed plugin package"}],',
        '            "warnings": [],',
        '        },',
        '        "artifacts": {"normalized_document_artifact_ref": "plugin-artifact:v1:installed"},',
        '        "parser": {"method": "installed_document_extract_plugin"},',
        '    }, ensure_ascii=False)',
      ].join('\n'),
      'utf-8',
    )
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      file('source.pdf', 'pdf'),
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')

    const result = await ingestKnowledgeUpload(workspaceRoot, {
      uploadRef: upload.stagedUploadRef,
      confirmed: true,
      workspaceId: path.basename(workspaceRoot),
      sessionId: `${path.basename(workspaceRoot)}:knowledge-ui`,
    })

    expect(result).toMatchObject({
      ok: true,
      parserMethod: 'installed_document_extract_plugin',
      normalizedDocumentArtifactRef: 'plugin-artifact:v1:installed',
    })
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', 'raw', 'source.md'),
        'utf-8',
      ),
    ).toContain('Text from installed plugin package')
  })

  it('can force parser-backed imports into the selected workspace wiki folder', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-force-wiki-')
    createdRoots.push(workspaceRoot)
    writeKnowledgeBaseConfig(
      { source: { type: 'local', path: 'knowledge-base' } },
      workspaceRoot,
    )
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      file('source.docx', 'docx'),
      '招投标',
      { forceWorkspaceWikiRoot: true },
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')

    const result = await ingestKnowledgeUpload(
      workspaceRoot,
      {
        uploadRef: upload.stagedUploadRef,
        confirmed: true,
        targetDir: '招投标',
        forceWorkspaceWikiRoot: true,
      },
      {
        extractDocumentContent: async () => ({
          normalized_document_artifact_ref: 'canonical_document:v1:doc',
          parser: { method: 'document_extraction.local.v1' },
          text_blocks: [{ text: '招投标 extracted text' }],
        }),
      },
    )

    expect(result).toMatchObject({
      ok: true,
      storedMarkdownPath: '招投标/source.md',
      sourceFilePath: '招投标/source.docx',
    })
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', '招投标', 'source.md'),
        'utf-8',
      ),
    ).toContain('招投标 extracted text')
    expect(
      fsSync.existsSync(
        path.join(workspaceRoot, 'knowledge-base', '招投标', 'source.md'),
      ),
    ).toBe(false)
  })

  it('builds a wiki page with extracted Chinese text from a PDF artifact', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-chinese-pdf-')
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      binaryFile(
        '中华人民共和国招标投标法.pdf',
        new Uint8Array([37, 80, 68, 70]),
        'application/pdf',
      ),
      '招投标',
      { forceWorkspaceWikiRoot: true },
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')

    const workspaceId = path.basename(workspaceRoot)
    const result = await ingestKnowledgeUpload(
      workspaceRoot,
      {
        uploadRef: upload.stagedUploadRef,
        confirmed: true,
        targetDir: '招投标',
        languageHint: 'zh',
        workspaceId,
        sessionId: `${workspaceId}:knowledge-ui`,
        forceWorkspaceWikiRoot: true,
      },
      {
        extractDocumentContent: async () => ({
          normalized_document_artifact_ref:
            'artifacts/document_extraction/chinese-law.json',
          parser: { method: 'native_pdf' },
          text_blocks: [
            { text: '中华人民共和国招标投标法' },
            { text: '第一条 为了规范招标投标活动，制定本法。' },
          ],
        }),
      },
    )

    expect(result).toMatchObject({
      ok: true,
      status: 'parsed',
      storedMarkdownPath: '招投标/中华人民共和国招标投标法.md',
      parserMethod: 'native_pdf',
    })
    const markdown = fsSync.readFileSync(
      path.join(workspaceRoot, 'wiki', '招投标', '中华人民共和国招标投标法.md'),
      'utf-8',
    )
    expect(markdown).toContain('中华人民共和国招标投标法')
    expect(markdown).toContain('第一条 为了规范招标投标活动')
    expect(markdown).not.toContain('%PDF-1.5')
    expect(markdown).not.toContain('1 0 obj')
    expect(markdown).not.toContain('stream')
  })

  it('does not write markdown for an unextractable empty PDF artifact', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-empty-pdf-')
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      binaryFile(
        '中华人民共和国招标投标法.pdf',
        new Uint8Array([37, 80, 68, 70]),
        'application/pdf',
      ),
      '招投标',
      { forceWorkspaceWikiRoot: true },
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')

    const result = await ingestKnowledgeUpload(
      workspaceRoot,
      {
        uploadRef: upload.stagedUploadRef,
        confirmed: true,
        targetDir: '招投标',
        languageHint: 'zh',
        forceWorkspaceWikiRoot: true,
      },
      {
        extractDocumentContent: async () => ({
          normalized_document_artifact_ref:
            'artifacts/document_extraction/empty-law.json',
          parser: { method: 'pdf_unextractable' },
          text_blocks: [],
          blocks: [],
          tables: [],
        }),
      },
    )

    expect(result).toMatchObject({
      ok: false,
      status: 'failed',
      code: 'empty_artifact',
      retryUploadRef: upload.stagedUploadRef,
    })
    expect(
      fsSync.existsSync(
        path.join(
          workspaceRoot,
          'wiki',
          '招投标',
          '中华人民共和国招标投标法.md',
        ),
      ),
    ).toBe(false)
  })

  it('writes curation markdown for an unextractable PDF when human justification is provided', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-justified-pdf-')
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      binaryFile(
        '中华人民共和国招标投标法.pdf',
        new Uint8Array([37, 80, 68, 70]),
        'application/pdf',
      ),
      '招投标',
      { forceWorkspaceWikiRoot: true },
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')

    const result = await ingestKnowledgeUpload(
      workspaceRoot,
      {
        uploadRef: upload.stagedUploadRef,
        confirmed: true,
        targetDir: '招投标',
        forceWorkspaceWikiRoot: true,
        manualCurationJustification:
          'Reviewer confirmed this is curation material only and requires governed promotion before authority use.',
      },
      {
        extractDocumentContent: async () => ({
          normalized_document_artifact_ref:
            'artifacts/document_extraction/empty-law.json',
          parser: { method: 'pdf_unextractable' },
          text_blocks: [],
          blocks: [],
          tables: [],
        }),
      },
    )

    expect(result).toMatchObject({
      ok: true,
      status: 'empty',
      storedMarkdownPath: '招投标/中华人民共和国招标投标法.md',
      parserMethod: 'pdf_unextractable',
    })
    const markdown = fsSync.readFileSync(
      path.join(workspaceRoot, 'wiki', '招投标', '中华人民共和国招标投标法.md'),
      'utf-8',
    )
    expect(markdown).toContain('Parser method: pdf_unextractable')
    expect(markdown).toContain('Authority level: curation_only')
    expect(markdown).toContain('Human curation justification:')
    expect(markdown).toContain(
      'requires governed promotion before authority use',
    )
  })

  it('replaces the exact existing markdown for the same source upload ref', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-replace-pdf-')
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      binaryFile(
        '中华人民共和国招标投标法.pdf',
        new Uint8Array([37, 80]),
        'application/pdf',
      ),
      '招投标',
      { forceWorkspaceWikiRoot: true },
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')
    const exactPath = path.join(
      workspaceRoot,
      'wiki',
      '招投标',
      '中华人民共和国招标投标法.md',
    )
    fsSync.writeFileSync(
      exactPath,
      [
        '# 中华人民共和国招标投标法.pdf',
        '',
        '> Curation material only. Governed promotion is required before authority use.',
        `> Source upload ref: ${upload.stagedUploadRef}`,
        '> Normalized artifact ref: artifacts/document_extraction/old.json',
        '> Parser method: pdf_unextractable',
      ].join('\n'),
    )

    const result = await ingestKnowledgeUpload(
      workspaceRoot,
      {
        uploadRef: upload.stagedUploadRef,
        confirmed: true,
        targetDir: '招投标',
        forceWorkspaceWikiRoot: true,
        manualCurationJustification:
          'Reviewer approved curation markdown refresh.',
      },
      {
        extractDocumentContent: async () => ({
          normalized_document_artifact_ref:
            'artifacts/document_extraction/ef698189d9f9.json',
          parser: { method: 'pdf_unextractable' },
          text_blocks: [],
          blocks: [],
          tables: [],
        }),
      },
    )

    expect(result).toMatchObject({
      ok: true,
      storedMarkdownPath: '招投标/中华人民共和国招标投标法.md',
      status: 'empty',
    })
    expect(
      fsSync.existsSync(
        path.join(
          workspaceRoot,
          'wiki',
          '招投标',
          '中华人民共和国招标投标法-2.md',
        ),
      ),
    ).toBe(false)
    const markdown = fsSync.readFileSync(exactPath, 'utf-8')
    expect(markdown).toContain('Authority level: curation_only')
    expect(markdown).toContain('Reviewer approved curation markdown refresh.')
    expect(markdown).toContain(
      'artifacts/document_extraction/ef698189d9f9.json',
    )
  })

  it('routes xlsx refs through the table ingestion boundary before wiki rendering', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-table-')
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      file('sheet.xlsx', 'xlsx'),
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')
    const ingestTableArtifact = vi.fn(async () => ({
      canonical_table_artifact_ref: 'canonical_table:v1:sheet',
      parser_method: 'table_ingestion',
    }))

    await expect(
      ingestKnowledgeUpload(
        workspaceRoot,
        { uploadRef: upload.stagedUploadRef, confirmed: true },
        { ingestTableArtifact },
      ),
    ).resolves.toMatchObject({
      ok: true,
      storedMarkdownPath: 'raw/sheet.md',
      sourceFilePath: 'sheet.xlsx',
      normalizedDocumentArtifactRef: 'canonical_table:v1:sheet',
    })
    expect(ingestTableArtifact).toHaveBeenCalled()
    expect(
      fsSync.readFileSync(
        path.join(workspaceRoot, 'wiki', 'raw', 'sheet.md'),
        'utf-8',
      ),
    ).toContain('Source file: wiki/sheet.xlsx')
  })

  it('returns retryable parser failure without writing partial markdown', async () => {
    const workspaceRoot = makeWorkspaceRoot('knowledge-ingest-fail-')
    createdRoots.push(workspaceRoot)
    const upload = await writeKnowledgeUpload(
      workspaceRoot,
      file('source.docx', 'docx'),
    )
    if (!upload.ok || upload.kind !== 'staged_for_ingest')
      throw new Error('stage failed')

    const result = await ingestKnowledgeUpload(
      workspaceRoot,
      { uploadRef: upload.stagedUploadRef, confirmed: true },
      {
        extractDocumentContent: async () => {
          throw new Error('temporary parser failure')
        },
      },
    )

    expect(result).toMatchObject({
      ok: false,
      code: 'parser_failed',
      retryUploadRef: upload.stagedUploadRef,
    })
    expect(
      fsSync.existsSync(path.join(workspaceRoot, 'wiki', 'raw', 'source.md')),
    ).toBe(false)
  })
})
