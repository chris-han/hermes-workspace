import path from 'node:path'
import * as fs from 'node:fs/promises'

import {
  KNOWLEDGE_UPLOAD_LIMITS,
  decodeStagedUploadRef,
  limitFailure,
  sanitizeKnowledgeFilename,
} from './knowledge-files'
import { resolveKnowledgeBaseConfig } from './knowledge-config'
import type { KnowledgeLimitFailure } from './knowledge-files'

type CanonicalDocumentBlock = {
  type?: string
  text?: string
  rows?: Array<Array<unknown>>
}

type CanonicalDocumentArtifact = {
  artifact_ref?: string
  normalized_document_artifact_ref?: string
  source_hash?: string
  parser?: { method?: string }
  blocks?: Array<CanonicalDocumentBlock>
  text_blocks?: Array<{ text?: string }>
  tables?: Array<{ rows?: Array<Array<unknown>> }>
  warnings?: Array<string>
}

export type KnowledgeIngestRequest = {
  uploadRef: string
  confirmed: boolean
  targetDir?: string | null
  languageHint?: string | null
  workspaceId?: string | null
  sessionId?: string | null
}

export type KnowledgeIngestSuccess = {
  ok: true
  status: 'parsed' | 'empty' | 'renamed'
  originalName: string
  storedMarkdownPath: string
  parserMethod: string
  sourceUploadRef: string
  normalizedDocumentArtifactRef: string
  sourceHash?: string
  retryUploadRef?: string
  warnings: Array<string>
  curationMaterial: true
  governedPromotionRequired: true
}

export type KnowledgeIngestFailure = {
  ok: false
  status: 'failed'
  originalName?: string
  code:
    | 'confirmation_required'
    | 'invalid_upload_ref'
    | 'path_outside_wiki_root'
    | 'parser_failed'
    | 'empty_artifact'
  message: string
  retryUploadRef?: string
}

export type KnowledgeIngestResult =
  | KnowledgeIngestSuccess
  | KnowledgeIngestFailure
  | KnowledgeLimitFailure

export type KnowledgeIngestDependencies = {
  extractDocumentContent?: (args: {
    document_ref: string
    workspace_id: string
    session_id: string
    mode: 'live'
    language_hint?: string | null
  }) => Promise<CanonicalDocumentArtifact> | CanonicalDocumentArtifact
  ingestTableArtifact?: (args: {
    upload_ref: string
    workspace_id: string
    session_id: string
    mode: 'live'
  }) => Promise<{
    canonical_table_artifact_ref: string
    parser_method?: string
    warnings?: Array<string>
  }>
}

function ensureInsideRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidate)
  const relative = path.relative(resolvedRoot, resolvedCandidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path is outside wiki root')
  }
  return resolvedCandidate
}

function toPosixPath(input: string): string {
  return input.split(path.sep).join('/')
}

function resolveTargetDirectory(
  effectiveRoot: string,
  requestedPath?: string | null,
) {
  const raw = requestedPath?.trim() || 'raw'
  if (path.isAbsolute(raw)) throw new Error('Path is outside wiki root')
  return ensureInsideRoot(effectiveRoot, path.resolve(effectiveRoot, raw))
}

async function writeFileExclusive(
  pathname: string,
  content: string,
): Promise<boolean> {
  let handle: fs.FileHandle | null = null
  try {
    handle = await fs.open(pathname, 'wx')
    await handle.writeFile(content, 'utf-8')
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw error
  } finally {
    await handle?.close()
  }
}

async function writeMarkdownWithCollision(
  directory: string,
  filename: string,
  content: string,
) {
  const ext = path.extname(filename)
  const basename = filename.slice(0, filename.length - ext.length)
  for (let index = 1; index <= 100; index += 1) {
    const storedName = index === 1 ? filename : `${basename}-${index}${ext}`
    const fullPath = path.join(directory, storedName)
    if (await writeFileExclusive(fullPath, content)) {
      return { storedName, fullPath, renamed: index > 1 }
    }
  }
  throw new Error('Upload name collision limit reached')
}

function markdownTable(rows: Array<Array<unknown>>): string {
  if (rows.length === 0) return ''
  if (rows.length > 40 || Math.max(...rows.map((row) => row.length)) > 8) {
    return '_Table omitted; see canonical artifact reference._'
  }
  const normalized = rows.map((row) => row.map((cell) => String(cell ?? '')))
  const header = normalized[0] ?? []
  const body = normalized.slice(1)
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function blocksFromArtifact(artifact: CanonicalDocumentArtifact) {
  const blocks = [...(artifact.blocks ?? [])]
  for (const text of artifact.text_blocks ?? []) {
    blocks.push({ type: 'text', text: text.text })
  }
  for (const table of artifact.tables ?? []) {
    blocks.push({ type: 'table', rows: table.rows })
  }
  return blocks
}

function renderDocumentMarkdown(
  originalName: string,
  uploadRef: string,
  artifact: CanonicalDocumentArtifact,
): {
  markdown: string
  empty: boolean
  parserMethod: string
  artifactRef: string
} {
  const parserMethod = artifact.parser?.method || 'document_extraction'
  const artifactRef =
    artifact.normalized_document_artifact_ref ||
    artifact.artifact_ref ||
    'canonical_document.unavailable'
  const body = blocksFromArtifact(artifact)
    .map((block) => {
      if (block.type === 'table' || block.rows)
        return markdownTable(block.rows ?? [])
      return String(block.text ?? '').trim()
    })
    .filter(Boolean)
  const provenance = [
    '> Curation material only. Governed promotion is required before authority use.',
    `> Source upload ref: ${uploadRef}`,
    `> Normalized artifact ref: ${artifactRef}`,
    `> Parser method: ${parserMethod}`,
    artifact.source_hash ? `> Source hash: ${artifact.source_hash}` : '',
  ].filter(Boolean)
  return {
    markdown: [`# ${originalName}`, '', ...provenance, '', ...body].join('\n'),
    empty: body.length === 0,
    parserMethod,
    artifactRef,
  }
}

export async function ingestKnowledgeUpload(
  workspaceRoot: string,
  request: KnowledgeIngestRequest,
  deps: KnowledgeIngestDependencies = {},
): Promise<KnowledgeIngestResult> {
  if (!request.confirmed) {
    return {
      ok: false,
      status: 'failed',
      code: 'confirmation_required',
      message: 'Review and import confirmation is required',
    }
  }

  let staged: ReturnType<typeof decodeStagedUploadRef>
  try {
    staged = decodeStagedUploadRef(request.uploadRef)
  } catch {
    return {
      ok: false,
      status: 'failed',
      code: 'invalid_upload_ref',
      message: 'Invalid governed upload ref',
    }
  }

  if (staged.size > KNOWLEDGE_UPLOAD_LIMITS.maxParserFileBytes) {
    return limitFailure('file_too_large', 'ingest', {
      filename: staged.originalName,
      limitBytes: KNOWLEDGE_UPLOAD_LIMITS.maxParserFileBytes,
      actualBytes: staged.size,
    })
  }

  const stagedPath = ensureInsideRoot(
    workspaceRoot,
    path.resolve(workspaceRoot, staged.relativePath),
  )
  try {
    await fs.access(stagedPath)
  } catch {
    return {
      ok: false,
      status: 'failed',
      originalName: staged.originalName,
      code: 'invalid_upload_ref',
      message: 'Governed upload ref is not available',
      retryUploadRef: request.uploadRef,
    }
  }

  const resolved = resolveKnowledgeBaseConfig(workspaceRoot)
  ensureInsideRoot(workspaceRoot, resolved.effectiveRoot)
  const outputDir = resolveTargetDirectory(
    resolved.effectiveRoot,
    request.targetDir,
  )
  await fs.mkdir(outputDir, { recursive: true })

  try {
    if (staged.ingestKind === 'table_ingestion') {
      const ingestTableArtifact =
        deps.ingestTableArtifact ??
        (() => {
          throw new Error('table_ingestion boundary is not available')
        })
      const table = await ingestTableArtifact({
        upload_ref: request.uploadRef,
        workspace_id: request.workspaceId || staged.workspaceId,
        session_id: request.sessionId || staged.sessionId,
        mode: 'live',
      })
      const filename = sanitizeKnowledgeFilename(
        `${path.basename(staged.originalName, path.extname(staged.originalName))}.md`,
      )
      const markdown = [
        `# ${staged.originalName}`,
        '',
        '> Spreadsheet wiki summary is curation material only.',
        `> Source upload ref: ${request.uploadRef}`,
        `> Canonical table artifact ref: ${table.canonical_table_artifact_ref}`,
        `> Parser method: ${table.parser_method || 'table_ingestion'}`,
      ].join('\n')
      const written = await writeMarkdownWithCollision(
        outputDir,
        filename,
        markdown,
      )
      return {
        ok: true,
        status: written.renamed ? 'renamed' : 'parsed',
        originalName: staged.originalName,
        storedMarkdownPath: toPosixPath(
          path.relative(resolved.effectiveRoot, written.fullPath),
        ),
        parserMethod: table.parser_method || 'table_ingestion',
        sourceUploadRef: request.uploadRef,
        normalizedDocumentArtifactRef: table.canonical_table_artifact_ref,
        retryUploadRef: request.uploadRef,
        warnings: table.warnings ?? [],
        curationMaterial: true,
        governedPromotionRequired: true,
      }
    }

    const extractDocumentContent =
      deps.extractDocumentContent ??
      (() => {
        throw new Error(
          'document_extraction.extract_document_content is not available',
        )
      })
    const artifact = await extractDocumentContent({
      document_ref: request.uploadRef,
      workspace_id: request.workspaceId || staged.workspaceId,
      session_id: request.sessionId || staged.sessionId,
      mode: 'live',
      language_hint: request.languageHint,
    })
    const rendered = renderDocumentMarkdown(
      staged.originalName,
      request.uploadRef,
      artifact,
    )
    const filename = sanitizeKnowledgeFilename(
      `${path.basename(staged.originalName, path.extname(staged.originalName))}.md`,
    )
    const written = await writeMarkdownWithCollision(
      outputDir,
      filename,
      rendered.markdown,
    )
    return {
      ok: true,
      status: rendered.empty ? 'empty' : written.renamed ? 'renamed' : 'parsed',
      originalName: staged.originalName,
      storedMarkdownPath: toPosixPath(
        path.relative(resolved.effectiveRoot, written.fullPath),
      ),
      parserMethod: rendered.parserMethod,
      sourceUploadRef: request.uploadRef,
      normalizedDocumentArtifactRef: rendered.artifactRef,
      sourceHash: artifact.source_hash,
      retryUploadRef: request.uploadRef,
      warnings: artifact.warnings ?? [],
      curationMaterial: true,
      governedPromotionRequired: true,
    }
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      originalName: staged.originalName,
      code: 'parser_failed',
      message: error instanceof Error ? error.message : 'Parser failed',
      retryUploadRef: request.uploadRef,
    }
  }
}
