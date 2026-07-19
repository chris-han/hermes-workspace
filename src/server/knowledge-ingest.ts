import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import * as fs from 'node:fs/promises'
import { promisify } from 'node:util'

import {
  KNOWLEDGE_UPLOAD_LIMITS,
  decodeStagedUploadRef,
  limitFailure,
  sanitizeKnowledgeFilename,
} from './knowledge-files'
import {
  WORKSPACE_WIKI_DIRNAME,
  resolveKnowledgeBaseConfig,
} from './knowledge-config'
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

type DocumentExtractionPluginResult = {
  status?: string
  error_code?: string
  document?: CanonicalDocumentArtifact
  artifacts?: {
    normalized_document_artifact_ref?: string
    source_artifact_ref?: string
    provider_artifact_refs?: Array<string>
  }
  parser?: { method?: string }
}

const execFileAsync = promisify(execFile)

export type KnowledgeIngestRequest = {
  uploadRef: string
  confirmed: boolean
  targetDir?: string | null
  languageHint?: string | null
  workspaceId?: string | null
  sessionId?: string | null
  forceWorkspaceWikiRoot?: boolean
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
  emitEvent?: (event: {
    stage: 'extract' | 'build' | 'complete'
    status: 'running' | 'done' | 'failed'
    label: string
    detail?: string
    filename?: string
    targetPath?: string
    uploadRef?: string
  }) => void
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

function findSemantierRuntimeRoot(): string {
  let current = path.resolve(process.cwd())
  for (let index = 0; index < 8; index += 1) {
    if (
      existsSync(
        path.join(current, 'src', 'plugins', 'document_extraction', 'tools.py'),
      )
    ) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  throw new Error('document_extraction plugin is not available')
}

async function extractDocumentContentWithPlugin(
  workspaceRoot: string,
  args: {
    document_ref: string
    workspace_id: string
    session_id: string
    mode: 'live'
    language_hint?: string | null
  },
): Promise<CanonicalDocumentArtifact> {
  const runtimeRoot = findSemantierRuntimeRoot()
  const pythonPath = path.join(runtimeRoot, 'src')
  const script = [
    'import json, sys',
    'from plugins.document_extraction.tools import extract_document_content',
    'payload = json.loads(sys.argv[1])',
    'result = extract_document_content(payload)',
    'print(result)',
  ].join('\n')
  const { stdout } = await execFileAsync(
    process.env.PYTHON || 'python3',
    ['-c', script, JSON.stringify(args)],
    {
      cwd: runtimeRoot,
      env: {
        ...process.env,
        HERMES_HOME: path.resolve(workspaceRoot),
        SESSION_HERMES_HOME: path.resolve(workspaceRoot),
        SESSION_ID: args.session_id,
        PYTHONPATH: process.env.PYTHONPATH
          ? `${pythonPath}${path.delimiter}${process.env.PYTHONPATH}`
          : pythonPath,
      },
      maxBuffer: 20 * 1024 * 1024,
    },
  )
  const parsed = JSON.parse(stdout) as DocumentExtractionPluginResult
  if (parsed.status === 'error') {
    throw new Error(parsed.error_code || 'document extraction failed')
  }
  const document = parsed.document ?? {}
  return {
    ...document,
    artifact_ref:
      document.artifact_ref ||
      parsed.artifacts?.normalized_document_artifact_ref,
    normalized_document_artifact_ref:
      document.normalized_document_artifact_ref ||
      parsed.artifacts?.normalized_document_artifact_ref,
    source_hash: document.source_hash,
    parser: document.parser || parsed.parser,
    warnings: document.warnings ?? [],
  }
}

async function ingestTableArtifactWithDocumentExtraction(
  workspaceRoot: string,
  args: {
    document_ref: string
    upload_ref: string
    workspace_id: string
    session_id: string
    mode: 'live'
  },
): Promise<{
  canonical_table_artifact_ref: string
  parser_method?: string
  warnings?: Array<string>
}> {
  const artifact = await extractDocumentContentWithPlugin(workspaceRoot, {
    document_ref: args.document_ref,
    workspace_id: args.workspace_id,
    session_id: args.session_id,
    mode: args.mode,
  })
  return {
    canonical_table_artifact_ref:
      artifact.normalized_document_artifact_ref ||
      artifact.artifact_ref ||
      'canonical_table.unavailable',
    parser_method: artifact.parser?.method || 'document_extraction.local.v1',
    warnings: artifact.warnings,
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

  const configured = resolveKnowledgeBaseConfig(workspaceRoot)
  const resolved = request.forceWorkspaceWikiRoot
    ? {
        ...configured,
        effectiveRoot: path.join(
          path.resolve(workspaceRoot),
          WORKSPACE_WIKI_DIRNAME,
        ),
      }
    : configured
  ensureInsideRoot(workspaceRoot, resolved.effectiveRoot)
  const outputDir = resolveTargetDirectory(
    resolved.effectiveRoot,
    request.targetDir,
  )
  await fs.mkdir(outputDir, { recursive: true })

  try {
    deps.emitEvent?.({
      stage: 'extract',
      status: 'running',
      label: `Extracting ${staged.originalName}`,
      detail: staged.relativePath,
      filename: staged.originalName,
      targetPath: staged.relativePath,
      uploadRef: request.uploadRef,
    })
    if (staged.ingestKind === 'table_ingestion') {
      const ingestTableArtifact =
        deps.ingestTableArtifact ??
        ((args) =>
          ingestTableArtifactWithDocumentExtraction(workspaceRoot, {
            document_ref: staged.relativePath,
            upload_ref: args.upload_ref,
            workspace_id: args.workspace_id,
            session_id: args.session_id,
            mode: args.mode,
          }))
      const table = await ingestTableArtifact({
        upload_ref: request.uploadRef,
        workspace_id: request.workspaceId || staged.workspaceId,
        session_id: request.sessionId || staged.sessionId,
        mode: 'live',
      })
      deps.emitEvent?.({
        stage: 'build',
        status: 'running',
        label: `Building wiki page for ${staged.originalName}`,
        detail: toPosixPath(path.relative(resolved.effectiveRoot, outputDir)),
        filename: staged.originalName,
        targetPath: toPosixPath(
          path.relative(resolved.effectiveRoot, outputDir),
        ),
        uploadRef: request.uploadRef,
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
      const storedMarkdownPath = toPosixPath(
        path.relative(resolved.effectiveRoot, written.fullPath),
      )
      deps.emitEvent?.({
        stage: 'complete',
        status: 'done',
        label: `Built wiki page for ${staged.originalName}`,
        detail: `wiki/${storedMarkdownPath}`,
        filename: staged.originalName,
        targetPath: storedMarkdownPath,
        uploadRef: request.uploadRef,
      })
      return {
        ok: true,
        status: written.renamed ? 'renamed' : 'parsed',
        originalName: staged.originalName,
        storedMarkdownPath,
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
      ((args) => extractDocumentContentWithPlugin(workspaceRoot, args))
    const artifact = await extractDocumentContent({
      document_ref: staged.relativePath,
      workspace_id: request.workspaceId || staged.workspaceId,
      session_id: request.sessionId || staged.sessionId,
      mode: 'live',
      language_hint: request.languageHint,
    })
    deps.emitEvent?.({
      stage: 'build',
      status: 'running',
      label: `Building wiki page for ${staged.originalName}`,
      detail: toPosixPath(path.relative(resolved.effectiveRoot, outputDir)),
      filename: staged.originalName,
      targetPath: toPosixPath(path.relative(resolved.effectiveRoot, outputDir)),
      uploadRef: request.uploadRef,
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
    const storedMarkdownPath = toPosixPath(
      path.relative(resolved.effectiveRoot, written.fullPath),
    )
    deps.emitEvent?.({
      stage: 'complete',
      status: 'done',
      label: `Built wiki page for ${staged.originalName}`,
      detail: `wiki/${storedMarkdownPath}`,
      filename: staged.originalName,
      targetPath: storedMarkdownPath,
      uploadRef: request.uploadRef,
    })
    return {
      ok: true,
      status: rendered.empty ? 'empty' : written.renamed ? 'renamed' : 'parsed',
      originalName: staged.originalName,
      storedMarkdownPath,
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
    deps.emitEvent?.({
      stage: 'complete',
      status: 'failed',
      label: `Wiki build failed: ${staged.originalName}`,
      detail: error instanceof Error ? error.message : 'Parser failed',
      filename: staged.originalName,
      targetPath: staged.relativePath,
      uploadRef: request.uploadRef,
    })
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
