import path from 'node:path'
import * as fs from 'node:fs/promises'

import {
  WORKSPACE_WIKI_DIRNAME,
  resolveKnowledgeBaseConfig,
} from './knowledge-config'

export type KnowledgeFileEntry = {
  name: string
  path: string
  kind: 'directory' | 'file'
  size?: number
  modified?: string
  children?: Array<KnowledgeFileEntry>
}

export type KnowledgeUploadDirectWrite = {
  ok: true
  kind: 'direct_write'
  originalName: string
  storedName: string
  path: string
  size: number
  renamed: boolean
}

export type KnowledgeUploadStagedForIngest = {
  ok: true
  kind: 'staged_for_ingest'
  originalName: string
  storedName: string
  size: number
  stagedUploadRef: string
  retryUploadRef: string
  requiresIngest: true
  ingestKind: 'document_extraction' | 'table_ingestion'
  canonicalArtifactKind: 'canonical_document' | 'canonical_table'
  targetWikiPath?: string
  warnings?: Array<string>
}

export type KnowledgeUploadFileFailure = {
  ok: false
  kind: 'file_failure'
  originalName: string
  code:
    | 'unsupported_extension'
    | 'path_outside_wiki_root'
    | 'name_collision_limit'
    | 'file_too_large'
    | 'stage_failed'
  message: string
  requiresParser?: boolean
  requiresTableIngest?: boolean
  retryable?: boolean
}

export type KnowledgeUploadResult =
  | KnowledgeUploadDirectWrite
  | KnowledgeUploadStagedForIngest
  | KnowledgeUploadFileFailure

export type KnowledgeLimitFailureCode =
  | 'too_many_files'
  | 'file_too_large'
  | 'batch_too_large'

export type KnowledgeLimitFailure = {
  ok: false
  code: KnowledgeLimitFailureCode
  message: string
  scope: 'request' | 'file' | 'batch' | 'ingest'
  filename?: string
  limitBytes?: number
  actualBytes?: number
  limitCount?: number
  actualCount?: number
}

export const KNOWLEDGE_UPLOAD_LIMITS = {
  maxFilesPerRequest: 10,
  maxDirectFileBytes: 2 * 1024 * 1024,
  maxParserFileBytes: 25 * 1024 * 1024,
  maxAggregateBatchBytes: 50 * 1024 * 1024,
} as const

export const DIRECT_KNOWLEDGE_UPLOAD_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
])

export const PARSER_BACKED_KNOWLEDGE_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.tif',
  '.tiff',
  '.bmp',
  '.webp',
  '.html',
  '.htm',
  '.xml',
  '.json',
])

const TABLE_INGESTION_EXTENSIONS = new Set(['.csv', '.xlsx'])
const COLLISION_LIMIT = 100

type KnowledgeFilesContext = {
  datasetType?: string | null
  forceWorkspaceWikiRoot?: boolean
}

type KnowledgeUploadContext = KnowledgeFilesContext & {
  ingestMode?: 'direct' | 'extract' | 'table'
  sessionId?: string | null
  workspaceId?: string | null
}

function toPosixPath(input: string): string {
  return input.split(path.sep).join('/')
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

function resolveEffectiveWikiRoot(
  workspaceRoot: string,
  context?: KnowledgeFilesContext,
) {
  const resolved = resolveKnowledgeBaseConfig(workspaceRoot, context)
  if (context?.forceWorkspaceWikiRoot) {
    const effectiveRoot = path.join(
      path.resolve(workspaceRoot),
      WORKSPACE_WIKI_DIRNAME,
    )
    return {
      ...resolved,
      effectiveRoot,
      effectiveRootLabel: WORKSPACE_WIKI_DIRNAME,
      usesWorkspaceDefault: true,
      upstreamWikiPath: effectiveRoot,
    }
  }
  ensureInsideRoot(workspaceRoot, resolved.effectiveRoot)
  return resolved
}

function resolveTargetDirectory(
  effectiveRoot: string,
  requestedPath?: string | null,
): string {
  const raw = requestedPath?.trim() ?? ''
  if (!raw) return path.resolve(effectiveRoot)
  if (path.isAbsolute(raw)) throw new Error('Path is outside wiki root')
  const resolved = path.resolve(effectiveRoot, raw)
  return ensureInsideRoot(effectiveRoot, resolved)
}

function relativeToWikiRoot(
  effectiveRoot: string,
  resolvedPath: string,
): string {
  return toPosixPath(path.relative(path.resolve(effectiveRoot), resolvedPath))
}

function buildBreadcrumb(
  relativePath: string,
): Array<{ label: string; path: string }> {
  const normalized = relativePath ? toPosixPath(relativePath) : ''
  const parts = normalized.split('/').filter(Boolean)
  const breadcrumb = [{ label: 'wiki', path: '' }]
  let current = ''
  for (const part of parts) {
    current = current ? `${current}/${part}` : part
    breadcrumb.push({ label: part, path: current })
  }
  return breadcrumb
}

async function readKnowledgeTree(
  effectiveRoot: string,
  directory: string,
  depth: number,
  maxDepth: number,
): Promise<Array<KnowledgeFileEntry>> {
  if (depth > maxDepth) return []
  const dirents = await fs.readdir(directory, { withFileTypes: true })
  const entries = await Promise.all(
    dirents
      .filter((entry) => entry.name !== '.git' && entry.name !== 'node_modules')
      .map(async (entry): Promise<KnowledgeFileEntry | null> => {
        const fullPath = path.join(directory, entry.name)
        const relativePath = relativeToWikiRoot(effectiveRoot, fullPath)
        if (relativePath.startsWith('..')) return null
        const stats = await fs.stat(fullPath)
        if (!stats.isDirectory() && !stats.isFile()) return null
        return {
          name: entry.name,
          path: relativePath,
          kind: stats.isDirectory() ? 'directory' : 'file',
          size: stats.isFile() ? stats.size : undefined,
          modified: stats.mtime.toISOString(),
          children: stats.isDirectory()
            ? await readKnowledgeTree(
                effectiveRoot,
                fullPath,
                depth + 1,
                maxDepth,
              )
            : undefined,
        }
      }),
  )
  const filtered = entries.filter(
    (entry): entry is KnowledgeFileEntry => !!entry,
  )
  filtered.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return filtered
}

export async function listKnowledgeTree(
  workspaceRoot: string,
  context?: KnowledgeFilesContext,
  maxDepth = 4,
): Promise<{
  configuredPath: string
  effectiveRoot: string
  effectiveRootLabel: string
  root: KnowledgeFileEntry
}> {
  const resolved = resolveEffectiveWikiRoot(workspaceRoot, context)
  const root = path.resolve(resolved.effectiveRoot)
  await fs.mkdir(root, { recursive: true })
  return {
    configuredPath: resolved.configuredPath,
    effectiveRoot: resolved.effectiveRoot,
    effectiveRootLabel: resolved.effectiveRootLabel,
    root: {
      name: 'wiki',
      path: '',
      kind: 'directory',
      children: await readKnowledgeTree(
        resolved.effectiveRoot,
        root,
        0,
        maxDepth,
      ),
    },
  }
}

export async function listKnowledgeDirectory(
  workspaceRoot: string,
  requestedPath?: string | null,
  context?: KnowledgeFilesContext,
): Promise<{
  configuredPath: string
  effectiveRoot: string
  effectiveRootLabel: string
  path: string
  breadcrumb: Array<{ label: string; path: string }>
  fileCount: number
  directoryCount: number
  entries: Array<KnowledgeFileEntry>
}> {
  const resolved = resolveEffectiveWikiRoot(workspaceRoot, context)
  const directory = resolveTargetDirectory(
    resolved.effectiveRoot,
    requestedPath,
  )
  await fs.mkdir(directory, { recursive: true })
  const dirents = await fs.readdir(directory, { withFileTypes: true })
  const entries = await Promise.all(
    dirents
      .filter((entry) => entry.name !== '.git' && entry.name !== 'node_modules')
      .map(async (entry): Promise<KnowledgeFileEntry | null> => {
        const fullPath = path.join(directory, entry.name)
        const relativePath = relativeToWikiRoot(
          resolved.effectiveRoot,
          fullPath,
        )
        if (relativePath.startsWith('..')) return null
        const stats = await fs.stat(fullPath)
        if (!stats.isDirectory() && !stats.isFile()) return null
        return {
          name: entry.name,
          path: relativePath,
          kind: stats.isDirectory() ? 'directory' : 'file',
          size: stats.isFile() ? stats.size : undefined,
          modified: stats.mtime.toISOString(),
        }
      }),
  )
  const filtered = entries.filter(
    (entry): entry is KnowledgeFileEntry => !!entry,
  )
  filtered.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  const relativePath = relativeToWikiRoot(resolved.effectiveRoot, directory)
  return {
    configuredPath: resolved.configuredPath,
    effectiveRoot: resolved.effectiveRoot,
    effectiveRootLabel: resolved.effectiveRootLabel,
    path: relativePath === '.' ? '' : relativePath,
    breadcrumb: buildBreadcrumb(relativePath === '.' ? '' : relativePath),
    fileCount: filtered.filter((entry) => entry.kind === 'file').length,
    directoryCount: filtered.filter((entry) => entry.kind === 'directory')
      .length,
    entries: filtered,
  }
}

export async function createKnowledgeDirectory(
  workspaceRoot: string,
  parentPath: string | null | undefined,
  folderName: string,
  context?: KnowledgeFilesContext,
): Promise<{
  ok: true
  name: string
  path: string
}> {
  const resolved = resolveEffectiveWikiRoot(workspaceRoot, context)
  const parentDirectory = resolveTargetDirectory(
    resolved.effectiveRoot,
    parentPath,
  )
  await fs.mkdir(parentDirectory, { recursive: true })
  const sanitizedName = sanitizeKnowledgeFilename(folderName)
  if (!sanitizedName || sanitizedName.includes('.')) {
    throw new Error('Folder name is invalid')
  }
  const targetDirectory = ensureInsideRoot(
    resolved.effectiveRoot,
    path.join(parentDirectory, sanitizedName),
  )
  await fs.mkdir(targetDirectory, { recursive: false })
  return {
    ok: true,
    name: sanitizedName,
    path: relativeToWikiRoot(resolved.effectiveRoot, targetDirectory),
  }
}

export function sanitizeKnowledgeFilename(input: string): string {
  const trimmed = input.trim()
  const cleaned = Array.from(trimmed)
    .map((char) => {
      const code = char.charCodeAt(0)
      return char === '/' ||
        char === '\\' ||
        code === 0 ||
        code < 32 ||
        code === 127
        ? '_'
        : char
    })
    .join('')
  const ext = path.extname(cleaned)
  const basename = cleaned.slice(0, cleaned.length - ext.length).trim()
  return `${basename || 'wiki-file'}${ext.toLowerCase()}`
}

async function writeFileExclusive(
  pathname: string,
  bytes: Uint8Array,
): Promise<boolean> {
  let handle: fs.FileHandle | null = null
  try {
    handle = await fs.open(pathname, 'wx')
    await handle.writeFile(bytes)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false
    }
    throw error
  } finally {
    await handle?.close()
  }
}

async function writeWithCollisionSuffix(
  directory: string,
  filename: string,
  bytes: Uint8Array,
): Promise<{ storedName: string; fullPath: string } | null> {
  const ext = path.extname(filename)
  const basename = filename.slice(0, filename.length - ext.length)
  for (let index = 1; index <= COLLISION_LIMIT; index += 1) {
    const storedName = index === 1 ? filename : `${basename}-${index}${ext}`
    const fullPath = path.join(directory, storedName)
    if (await writeFileExclusive(fullPath, bytes)) {
      return { storedName, fullPath }
    }
  }
  return null
}

function extensionFor(filename: string): string {
  return path.extname(filename).toLowerCase()
}

function markdownTargetFor(
  filename: string,
  targetDir?: string | null,
): string {
  const stem = path.basename(filename, path.extname(filename)) || 'wiki-file'
  const safeStem = sanitizeKnowledgeFilename(`${stem}.md`)
  return toPosixPath(path.join(targetDir?.trim() || 'raw', safeStem))
}

export function limitFailure(
  code: KnowledgeLimitFailureCode,
  scope: KnowledgeLimitFailure['scope'],
  details: Omit<
    KnowledgeLimitFailure,
    'ok' | 'code' | 'message' | 'scope'
  > = {},
): KnowledgeLimitFailure {
  const message =
    code === 'too_many_files'
      ? 'Too many files'
      : code === 'batch_too_large'
        ? 'Upload batch too large'
        : 'File too large'
  return { ok: false, code, message, scope, ...details }
}

function fileSize(file: File): number {
  return Number(file.size || 0)
}

export function validateKnowledgeUploadLimits(
  files: Array<File>,
): KnowledgeLimitFailure | null {
  if (files.length > KNOWLEDGE_UPLOAD_LIMITS.maxFilesPerRequest) {
    return limitFailure('too_many_files', 'request', {
      limitCount: KNOWLEDGE_UPLOAD_LIMITS.maxFilesPerRequest,
      actualCount: files.length,
    })
  }
  const aggregate = files.reduce((sum, file) => sum + fileSize(file), 0)
  if (aggregate > KNOWLEDGE_UPLOAD_LIMITS.maxAggregateBatchBytes) {
    return limitFailure('batch_too_large', 'batch', {
      limitBytes: KNOWLEDGE_UPLOAD_LIMITS.maxAggregateBatchBytes,
      actualBytes: aggregate,
    })
  }
  for (const file of files) {
    const ext = extensionFor(file.name)
    const parserSized =
      PARSER_BACKED_KNOWLEDGE_EXTENSIONS.has(ext) ||
      TABLE_INGESTION_EXTENSIONS.has(ext)
    const limit = parserSized
      ? KNOWLEDGE_UPLOAD_LIMITS.maxParserFileBytes
      : KNOWLEDGE_UPLOAD_LIMITS.maxDirectFileBytes
    if (fileSize(file) > limit) {
      return limitFailure('file_too_large', 'file', {
        filename: file.name,
        limitBytes: limit,
        actualBytes: fileSize(file),
      })
    }
  }
  return null
}

function encodeStagedUploadRef(payload: {
  workspaceId: string
  sessionId: string
  relativePath: string
  originalName: string
  size: number
  ingestKind: 'document_extraction' | 'table_ingestion'
  canonicalArtifactKind: 'canonical_document' | 'canonical_table'
}): string {
  return `knowledge-upload:v1:${Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  )}`
}

export function decodeStagedUploadRef(ref: string): {
  workspaceId: string
  sessionId: string
  relativePath: string
  originalName: string
  size: number
  ingestKind: 'document_extraction' | 'table_ingestion'
  canonicalArtifactKind: 'canonical_document' | 'canonical_table'
} {
  const prefix = 'knowledge-upload:v1:'
  if (!ref.startsWith(prefix)) throw new Error('Invalid governed upload ref')
  const parsed = JSON.parse(
    Buffer.from(ref.slice(prefix.length), 'base64url').toString('utf-8'),
  )
  if (
    !parsed ||
    typeof parsed.workspaceId !== 'string' ||
    typeof parsed.sessionId !== 'string' ||
    typeof parsed.relativePath !== 'string'
  ) {
    throw new Error('Invalid governed upload ref')
  }
  return parsed
}

async function stageKnowledgeUpload(
  workspaceRoot: string,
  file: File,
  sanitizedName: string,
  targetDir: string | null | undefined,
  context: KnowledgeUploadContext | undefined,
  ingestKind: 'document_extraction' | 'table_ingestion',
  canonicalArtifactKind: 'canonical_document' | 'canonical_table',
): Promise<KnowledgeUploadResult> {
  const workspaceId =
    context?.workspaceId || path.basename(path.resolve(workspaceRoot))
  const sessionId = context?.sessionId || 'knowledge-ui'
  const resolved = resolveEffectiveWikiRoot(workspaceRoot, context)
  const uploadsDir = resolveTargetDirectory(resolved.effectiveRoot, targetDir)
  const bytes = new Uint8Array(await file.arrayBuffer())
  await fs.mkdir(uploadsDir, { recursive: true })
  const written = await writeWithCollisionSuffix(
    uploadsDir,
    sanitizedName,
    bytes,
  )
  if (!written) {
    return {
      ok: false,
      kind: 'file_failure',
      originalName: file.name,
      code: 'name_collision_limit',
      message: 'Upload name collision limit reached',
      retryable: true,
    }
  }
  const relativePath = toPosixPath(
    path.relative(path.resolve(workspaceRoot), written.fullPath),
  )
  const ref = encodeStagedUploadRef({
    workspaceId,
    sessionId,
    relativePath,
    originalName: file.name,
    size: file.size,
    ingestKind,
    canonicalArtifactKind,
  })
  return {
    ok: true,
    kind: 'staged_for_ingest',
    originalName: file.name,
    storedName: written.storedName,
    size: file.size,
    stagedUploadRef: ref,
    retryUploadRef: ref,
    requiresIngest: true,
    ingestKind,
    canonicalArtifactKind,
    targetWikiPath: markdownTargetFor(sanitizedName, targetDir),
    warnings:
      ingestKind === 'table_ingestion'
        ? [
            'Spreadsheet wiki markdown is derived curation, not canonical table authority',
          ]
        : undefined,
  }
}

export async function writeKnowledgeUpload(
  workspaceRoot: string,
  file: File,
  targetDir?: string | null,
  context?: KnowledgeUploadContext,
): Promise<KnowledgeUploadResult> {
  const resolved = resolveEffectiveWikiRoot(workspaceRoot, context)
  const ext = extensionFor(file.name)
  const sanitizedName = sanitizeKnowledgeFilename(file.name)

  if (TABLE_INGESTION_EXTENSIONS.has(ext)) {
    if (file.size > KNOWLEDGE_UPLOAD_LIMITS.maxParserFileBytes) {
      return {
        ok: false,
        kind: 'file_failure',
        originalName: file.name,
        code: 'file_too_large',
        message: 'File too large',
        requiresTableIngest: true,
      }
    }
    return stageKnowledgeUpload(
      workspaceRoot,
      file,
      sanitizedName,
      targetDir,
      context,
      'table_ingestion',
      'canonical_table',
    )
  }

  const parserBacked =
    PARSER_BACKED_KNOWLEDGE_EXTENSIONS.has(ext) && ext !== '.json'
  const jsonExtract = ext === '.json' && context?.ingestMode === 'extract'

  if (parserBacked || jsonExtract) {
    if (context?.ingestMode === 'direct') {
      return {
        ok: false,
        kind: 'file_failure',
        originalName: file.name,
        code: 'unsupported_extension',
        message: 'Parser-backed files require review and import',
        requiresParser: true,
      }
    }
    if (file.size > KNOWLEDGE_UPLOAD_LIMITS.maxParserFileBytes) {
      return {
        ok: false,
        kind: 'file_failure',
        originalName: file.name,
        code: 'file_too_large',
        message: 'File too large',
        requiresParser: true,
      }
    }
    return stageKnowledgeUpload(
      workspaceRoot,
      file,
      sanitizedName,
      targetDir,
      context,
      'document_extraction',
      'canonical_document',
    )
  }

  if (!DIRECT_KNOWLEDGE_UPLOAD_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      kind: 'file_failure',
      originalName: file.name,
      code: 'unsupported_extension',
      message: 'Unsupported knowledge upload extension',
      requiresParser: PARSER_BACKED_KNOWLEDGE_EXTENSIONS.has(ext),
    }
  }

  if (file.size > KNOWLEDGE_UPLOAD_LIMITS.maxDirectFileBytes) {
    return {
      ok: false,
      kind: 'file_failure',
      originalName: file.name,
      code: 'file_too_large',
      message: 'File too large',
    }
  }

  const directory = resolveTargetDirectory(resolved.effectiveRoot, targetDir)
  await fs.mkdir(directory, { recursive: true })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const written = await writeWithCollisionSuffix(
    directory,
    sanitizedName,
    bytes,
  )
  if (!written) {
    return {
      ok: false,
      kind: 'file_failure',
      originalName: file.name,
      code: 'name_collision_limit',
      message: 'Upload name collision limit reached',
      retryable: true,
    }
  }
  return {
    ok: true,
    kind: 'direct_write',
    originalName: file.name,
    storedName: written.storedName,
    path: relativeToWikiRoot(resolved.effectiveRoot, written.fullPath),
    size: file.size,
    renamed: written.storedName !== file.name,
  }
}
