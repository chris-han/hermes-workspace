import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestKnowledgeUpload } from './knowledge-ingest'
import { writeKnowledgeUpload } from './knowledge-files'

function makeWorkspaceRoot(prefix: string): string {
  return fsSync.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function file(name: string, content: string): File {
  return new File([content], name)
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
        document_ref: upload.stagedUploadRef,
        mode: 'live',
      }),
    )
    expect(result).toMatchObject({
      ok: true,
      status: 'parsed',
      storedMarkdownPath: 'raw/source.md',
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
      normalizedDocumentArtifactRef: 'canonical_table:v1:sheet',
    })
    expect(ingestTableArtifact).toHaveBeenCalled()
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
