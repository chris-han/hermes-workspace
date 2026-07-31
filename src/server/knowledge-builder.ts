import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { decodeStagedUploadRef } from './knowledge-files'
import { ingestKnowledgeUpload } from './knowledge-ingest'
import {
  buildSemantierAgentProxyHeaders,
  withSemantierAgentBase,
} from './semantier-agent-api'
import type { ActiveWorkspaceRoot } from './workspace-root'

const execFileAsync = promisify(execFile)

export type KnowledgeBuilderState =
  | 'DISCOVERED'
  | 'CURATED'
  | 'PROPOSED'
  | 'APPROVED'
  | 'ACTIVATED'
  | 'REJECTED'

export type KnowledgeBuilderDiscoveryRun = Record<string, unknown> & {
  discovery_run_id: string
  run_status: string
  governance_state: KnowledgeBuilderState
}

export const KNOWLEDGE_BUILDER_RELATION_TYPES = [
  'synonym_of',
  'variant_of',
  'projects_to',
  'not_same_as',
  'allowed_context_for',
  'prohibited_context_for',
  'exception_to',
  'conflicts_with',
] as const

export type KnowledgeBuilderRelationType =
  (typeof KNOWLEDGE_BUILDER_RELATION_TYPES)[number]

export type KnowledgeBuilderSensitiveLexiconResult = {
  discoveryRun: Record<string, unknown>
  ingest: Record<string, unknown>
  importResult: {
    status: string
    knowledge_source?: Record<string, unknown>
    compilation_run?: Record<string, unknown>
    candidates?: Array<Record<string, unknown>>
    knowledge_builder_evidence?: Array<Record<string, unknown>>
    compiler_profile_version?: string
    normalization_policy_version?: string
  }
}

function findRuntimeRoot(workspaceRoot: string): string {
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
  if (
    existsSync(
      path.join(
        path.resolve(workspaceRoot),
        'src',
        'plugins',
        'document_extraction',
        'tools.py',
      ),
    )
  ) {
    return path.resolve(workspaceRoot)
  }
  throw new Error('semantier runtime root is not available')
}

function pythonPath(runtimeRoot: string, workspaceRoot: string): string {
  return [
    path.join(runtimeRoot, 'src', 'plugins'),
    path.join(runtimeRoot, 'src'),
    path.join(path.resolve(workspaceRoot), 'plugins'),
  ]
    .filter((candidate) => existsSync(candidate))
    .join(path.delimiter)
}

async function importSensitiveLexiconDocx(input: {
  activeWorkspace: ActiveWorkspaceRoot
  sessionId: string
  normalizedDocumentArtifactRef: string
  knowledgeSourceId: string
  sourceRef: string
}): Promise<KnowledgeBuilderSensitiveLexiconResult['importResult']> {
  if (!input.activeWorkspace.organizationId) {
    throw new Error('organization context required')
  }
  const runtimeRoot = findRuntimeRoot(input.activeWorkspace.path)
  const script = [
    'import json, sys',
    'from agents.sensitive_lexicon_docx_importer import import_sensitive_lexicon_docx',
    'payload = json.loads(sys.argv[1])',
    'result = import_sensitive_lexicon_docx(**payload)',
    'print(json.dumps(result, ensure_ascii=False))',
  ].join('\n')
  const payload = {
    normalized_document_artifact_ref: input.normalizedDocumentArtifactRef,
    organization_id: input.activeWorkspace.organizationId,
    workspace_id: input.activeWorkspace.workspaceId,
    knowledge_source_id: input.knowledgeSourceId,
    source_ref: input.sourceRef,
    created_by: 'knowledge_builder_compiler',
    proposed_workspace_id: input.activeWorkspace.workspaceId,
  }
  const { stdout } = await execFileAsync(
    process.env.PYTHON || 'python3',
    ['-c', script, JSON.stringify(payload)],
    {
      cwd: runtimeRoot,
      env: {
        ...process.env,
        HERMES_HOME: path.resolve(input.activeWorkspace.path),
        SESSION_HERMES_HOME: path.resolve(input.activeWorkspace.path),
        HERMES_SESSION_ID: input.sessionId,
        SESSION_ID: input.sessionId,
        PYTHONPATH: process.env.PYTHONPATH
          ? `${pythonPath(runtimeRoot, input.activeWorkspace.path)}${path.delimiter}${process.env.PYTHONPATH}`
          : pythonPath(runtimeRoot, input.activeWorkspace.path),
      },
      maxBuffer: 50 * 1024 * 1024,
    },
  )
  return JSON.parse(stdout)
}

async function requestKnowledgeBuilder<T>(
  requestHeaders: HeadersInit | Headers,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = buildSemantierAgentProxyHeaders(requestHeaders, {
    forwardBrowserCookies: true,
  })
  if (init?.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(withSemantierAgentBase(path), {
    ...init,
    headers,
  })
  const payload = (await response.json().catch(() => ({}))) as T & {
    detail?: unknown
    error?: unknown
  }
  if (!response.ok) {
    throw new Error(
      String(payload.detail || payload.error || `knowledge-builder-${response.status}`),
    )
  }
  return payload
}

export async function createKnowledgeBuilderDiscoveryRun(
  requestHeaders: HeadersInit | Headers,
  input: {
    sourceKind?: 'folder' | 'file' | 'text'
    sourceRef?: string
    sourceText?: string
    sourceMetadata?: Record<string, unknown>
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ run: Record<string, unknown> }>(
    requestHeaders,
    '/api/knowledge/builder/discovery-runs',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return payload.run
}

export async function compileKnowledgeBuilderSensitiveLexicon(
  requestHeaders: HeadersInit | Headers,
  activeWorkspace: ActiveWorkspaceRoot,
  input: {
    uploadRef: string
    sourceRef?: string
  },
): Promise<KnowledgeBuilderSensitiveLexiconResult> {
  const staged = decodeStagedUploadRef(input.uploadRef)
  if (staged.ingestKind !== 'document_extraction') {
    throw new Error('governed DOCX upload is required')
  }
  const ingest = await ingestKnowledgeUpload(activeWorkspace.path, {
    uploadRef: input.uploadRef,
    confirmed: true,
    targetDir: 'uploads',
    workspaceId: activeWorkspace.workspaceId,
    sessionId: staged.sessionId,
    forceWorkspaceWikiRoot: true,
  })
  if (!('ok' in ingest) || !ingest.ok) {
    const message =
      'message' in ingest && ingest.message
        ? String(ingest.message)
        : 'knowledge source document extraction failed'
    const code = 'code' in ingest && ingest.code ? ` (${ingest.code})` : ''
    throw new Error(`${message}${code}`)
  }
  const sourceRef = input.sourceRef?.trim() || ingest.sourceUploadRef
  const discoveryRun = await createKnowledgeBuilderDiscoveryRun(requestHeaders, {
    sourceKind: 'file',
    sourceRef,
    sourceMetadata: {
      governed_upload_ref: input.uploadRef,
      normalized_document_artifact_ref: ingest.normalizedDocumentArtifactRef,
      source_hash: ingest.sourceHash,
      semantic_purpose: 'sensitive_lexicon',
      compiler_profile_version: 'sensitive_lexicon_docx.v1',
    },
  })
  const sourceHashPart = String(ingest.sourceHash || ingest.normalizedDocumentArtifactRef)
    .replace(/^sha256:/, '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 40)
  const importResult = await importSensitiveLexiconDocx({
    activeWorkspace,
    sessionId: staged.sessionId,
    normalizedDocumentArtifactRef: ingest.normalizedDocumentArtifactRef,
    knowledgeSourceId: `ks_${sourceHashPart || 'sensitive_lexicon_docx'}`,
    sourceRef,
  })
  return {
    discoveryRun,
    ingest,
    importResult,
  }
}

export async function getKnowledgeBuilderDiscoveryRun(
  requestHeaders: HeadersInit | Headers,
  runId: string,
): Promise<KnowledgeBuilderDiscoveryRun> {
  const payload = await requestKnowledgeBuilder<{ run: KnowledgeBuilderDiscoveryRun }>(
    requestHeaders,
    `/api/knowledge/builder/discovery-runs/${encodeURIComponent(runId)}`,
  )
  return payload.run
}

export async function getKnowledgeBuilderCandidateExplanation(
  requestHeaders: HeadersInit | Headers,
  candidateId: string,
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ explanation: Record<string, unknown> }>(
    requestHeaders,
    `/api/knowledge/builder/candidates/${encodeURIComponent(candidateId)}/explanation`,
  )
  return payload.explanation
}

export async function curateKnowledgeBuilderRelation(
  requestHeaders: HeadersInit | Headers,
  input: {
    relationId: string
    decision: 'accept' | 'reject' | 'change'
    relationType: KnowledgeBuilderRelationType
    reviewerNotes?: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{
    relationCandidate: Record<string, unknown>
  }>(
    requestHeaders,
    `/api/knowledge/builder/relations/${encodeURIComponent(input.relationId)}/curation`,
    {
      method: 'POST',
      body: JSON.stringify({
        decision: input.decision,
        relationType: input.relationType,
        reviewerNotes: input.reviewerNotes,
      }),
    },
  )
  return payload.relationCandidate
}

export async function splitKnowledgeBuilderCluster(
  requestHeaders: HeadersInit | Headers,
  input: { clusterId: string; nodeIds: Array<string>; reviewerNotes?: string },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ curationEvent: Record<string, unknown> }>(
    requestHeaders,
    `/api/knowledge/builder/clusters/${encodeURIComponent(input.clusterId)}/split`,
    {
      method: 'POST',
      body: JSON.stringify({
        nodeIds: input.nodeIds,
        reviewerNotes: input.reviewerNotes,
      }),
    },
  )
  return payload.curationEvent
}

export async function mergeKnowledgeBuilderClusters(
  requestHeaders: HeadersInit | Headers,
  input: { clusterIds: Array<string>; reviewerNotes?: string },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ curationEvent: Record<string, unknown> }>(
    requestHeaders,
    '/api/knowledge/builder/clusters/merge',
    {
      method: 'POST',
      body: JSON.stringify({
        clusterIds: input.clusterIds,
        reviewerNotes: input.reviewerNotes,
      }),
    },
  )
  return payload.curationEvent
}

export async function createCanonicalTermCandidate(
  requestHeaders: HeadersInit | Headers,
  input: {
    discoveryRunId: string
    domain: string
    canonicalLabel: string
    definition: string
    aliases: Array<string>
    allowedContexts: Array<string>
    prohibitedContexts: Array<string>
    sourceAnchorRefs: Array<string>
    evidenceSummary: string
    proposedRuntimeEffect: Record<string, unknown>
    governanceState?: 'CURATED' | 'PROPOSED'
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{ termCandidate: Record<string, unknown> }>(
    requestHeaders,
    '/api/knowledge/builder/canonical-terms',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return payload.termCandidate
}

export async function promoteKnowledgeBuilderRuntimeSemantics(
  requestHeaders: HeadersInit | Headers,
  input: {
    termCandidateId: string
    semanticRelationCandidateIds: Array<string>
    evaluationRunId: string
  },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{
    authorityVersion: Record<string, unknown>
  }>(requestHeaders, '/api/knowledge/builder/promotions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return payload.authorityVersion
}

export async function rebuildKnowledgeBuilderReadModels(
  requestHeaders: HeadersInit | Headers,
  input: { authorityVersionId: string },
): Promise<Record<string, unknown>> {
  const payload = await requestKnowledgeBuilder<{
    readModelRebuild: Record<string, unknown>
  }>(requestHeaders, '/api/knowledge/builder/read-model-rebuilds', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return payload.readModelRebuild
}

export async function getKnowledgeBuilderRuntimeSemanticIndex(
  requestHeaders: HeadersInit | Headers,
  authorityVersionId: string,
): Promise<Record<string, unknown>> {
  return requestKnowledgeBuilder<Record<string, unknown>>(
    requestHeaders,
    `/api/knowledge/builder/runtime-semantic-index/${encodeURIComponent(authorityVersionId)}`,
  )
}

export async function listKnowledgeBuilderFeedbackDeltas(
  requestHeaders: HeadersInit | Headers,
  discoveryRunId?: string,
): Promise<Array<Record<string, unknown>>> {
  const query = discoveryRunId
    ? `?discoveryRunId=${encodeURIComponent(discoveryRunId)}`
    : ''
  const payload = await requestKnowledgeBuilder<{
    feedbackDeltas: Array<Record<string, unknown>>
  }>(requestHeaders, `/api/knowledge/builder/feedback-deltas${query}`)
  return payload.feedbackDeltas
}

export function isKnowledgeBuilderRuntimeAuthority(state: KnowledgeBuilderState): boolean {
  return state === 'ACTIVATED'
}
