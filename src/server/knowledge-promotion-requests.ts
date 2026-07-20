import crypto from 'node:crypto'
import path from 'node:path'
import * as fs from 'node:fs/promises'

import { readKnowledgePage } from './knowledge-browser'
import { WORKSPACE_WIKI_DIRNAME } from './knowledge-config'

export type PromotionTargetAuthorityLevel = 'T2' | 'T3' | 'T4' | 'T5'

export type KnowledgePromotionRequestInput = {
  pagePath: string
  targetAuthorityLevel: PromotionTargetAuthorityLevel
  justification: string
  sourceUri?: string | null
  jurisdiction?: string | null
  effectiveFrom?: string | null
  sourceVersion?: string | null
}

export type KnowledgePromotionRequest = {
  ok: true
  requestId: string
  status: 'PENDING_REVIEW' | 'NEEDS_SOURCE_REGISTRATION'
  requestPath: string
  blockers: Array<string>
}

export type KnowledgePromotionApprovedArtifact = {
  artifact_id: string
  source_ref: string
  semantic_tier: PromotionTargetAuthorityLevel
  authority_domain: string
  tag_authority_level: string
  source_type: string
  authority_origin: string
  ingestion_status: 'DEMO_APPROVED'
  effective_from?: string | null
  source_version?: string | null
  extraction_method?: string | null
  curator: string
  claim_count: number
  ambiguities: Array<string>
  evidence_chain: Array<{
    stage: string
    ref: string | null
    hash: string | null
  }>
}

export type KnowledgePromotionApproval = {
  ok: true
  requestId: string
  approvalId: string
  status: 'APPROVED'
  approvalPath: string
  approvedArtifact: KnowledgePromotionApprovedArtifact
}

type KnowledgePromotionContext = {
  datasetType?: string | null
  workspaceId?: string | null
  userId?: string | null
}

const PROMOTION_REQUEST_DIR = '.governance/promotion-requests'
const PROMOTION_APPROVAL_DIR = '.governance/promotion-approvals'
const TARGET_AUTHORITY_LEVELS = new Set<PromotionTargetAuthorityLevel>([
  'T2',
  'T3',
  'T4',
  'T5',
])

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

function requestIdForPayload(payload: object): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
  return `kpr_${hash.slice(0, 24)}`
}

function contentHash(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`
}

function hashObject(payload: object): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
}

function extractQuotedLine(content: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = content.match(new RegExp(`^>\\s*${escaped}:\\s*(.+)$`, 'im'))
  return match?.[1]?.trim() || null
}

function defaultSourceType(
  targetAuthorityLevel: PromotionTargetAuthorityLevel,
) {
  if (targetAuthorityLevel === 'T2') return 'official_regulation'
  if (targetAuthorityLevel === 'T4') return 'internal_policy'
  return 'field_guide'
}

function defaultAuthorityOrigin(
  targetAuthorityLevel: PromotionTargetAuthorityLevel,
) {
  if (targetAuthorityLevel === 'T2') return 'official_source'
  if (targetAuthorityLevel === 'T4' || targetAuthorityLevel === 'T5') {
    return 'internal_governance'
  }
  return 'interpretive_source'
}

function defaultAuthorityDomain(
  targetAuthorityLevel: PromotionTargetAuthorityLevel,
) {
  if (targetAuthorityLevel === 'T2') return 'compliance'
  if (targetAuthorityLevel === 'T5') return 'management'
  return 'compliance'
}

function defaultTagAuthorityLevel(
  targetAuthorityLevel: PromotionTargetAuthorityLevel,
) {
  if (targetAuthorityLevel === 'T2') return 'regulatory'
  if (targetAuthorityLevel === 'T5') return 'management'
  return 'operational'
}

export async function createKnowledgePromotionRequest(
  workspaceRoot: string,
  input: KnowledgePromotionRequestInput,
  context: KnowledgePromotionContext = {},
): Promise<KnowledgePromotionRequest> {
  const pagePath = input.pagePath.trim()
  const justification = input.justification.trim()
  if (!pagePath) throw new Error('pagePath is required')
  if (!TARGET_AUTHORITY_LEVELS.has(input.targetAuthorityLevel)) {
    throw new Error('targetAuthorityLevel is invalid')
  }
  if (!justification) throw new Error('justification is required')

  const page = readKnowledgePage(pagePath, workspaceRoot, {
    datasetType: context.datasetType,
    forceWorkspaceWikiRoot: true,
  })
  const sourceUploadRef = extractQuotedLine(page.content, 'Source upload ref')
  const normalizedArtifactRef = extractQuotedLine(
    page.content,
    'Normalized artifact ref',
  )
  const parserMethod = extractQuotedLine(page.content, 'Parser method')
  const humanCurationJustification = extractQuotedLine(
    page.content,
    'Human curation justification',
  )
  const sourceUri = input.sourceUri?.trim() || null
  const jurisdiction = input.jurisdiction?.trim() || null
  const effectiveFrom = input.effectiveFrom?.trim() || null
  const sourceVersion = input.sourceVersion?.trim() || null
  const blockers: Array<string> = []

  if (input.targetAuthorityLevel === 'T2') {
    if (!sourceUri) blockers.push('official_source_uri_required')
    if (!jurisdiction) blockers.push('jurisdiction_required')
    if (!effectiveFrom) blockers.push('effective_from_required')
    if (!sourceVersion) blockers.push('source_version_required')
  }

  const requestedAt = new Date().toISOString()
  const requestPayload = {
    schema_version: 'knowledge_promotion_request.v1',
    status:
      blockers.length > 0 ? 'NEEDS_SOURCE_REGISTRATION' : 'PENDING_REVIEW',
    requested_at: requestedAt,
    requested_by: context.userId || 'knowledge-ui',
    workspace_id: context.workspaceId || null,
    source_page: {
      path: page.meta.path,
      title: page.meta.title,
      content_hash: contentHash(page.content),
      authority_level: extractQuotedLine(page.content, 'Authority level'),
      authority_use: extractQuotedLine(page.content, 'Authority use'),
    },
    requested_target: {
      semantic_tier: input.targetAuthorityLevel,
      authority_domain: defaultAuthorityDomain(input.targetAuthorityLevel),
      tag_authority_level: defaultTagAuthorityLevel(input.targetAuthorityLevel),
      source_type: defaultSourceType(input.targetAuthorityLevel),
      authority_origin: defaultAuthorityOrigin(input.targetAuthorityLevel),
    },
    source_registration: {
      source_uri: sourceUri,
      jurisdiction,
      effective_from: effectiveFrom,
      source_version: sourceVersion,
      source_upload_ref: sourceUploadRef,
      normalized_artifact_ref: normalizedArtifactRef,
      parser_method: parserMethod,
    },
    justification,
    human_curation_justification: humanCurationJustification,
    blockers,
  }
  const requestId = requestIdForPayload(requestPayload)
  const wikiRoot = path.join(
    path.resolve(workspaceRoot),
    WORKSPACE_WIKI_DIRNAME,
  )
  const requestDir = ensureInsideRoot(
    path.resolve(workspaceRoot),
    path.join(wikiRoot, PROMOTION_REQUEST_DIR),
  )
  const requestPath = path.join(requestDir, `${requestId}.json`)
  await fs.mkdir(requestDir, { recursive: true })
  await fs
    .writeFile(
      requestPath,
      `${JSON.stringify({ request_id: requestId, ...requestPayload }, null, 2)}\n`,
      {
        encoding: 'utf-8',
        flag: 'wx',
      },
    )
    .catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    })

  return {
    ok: true,
    requestId,
    status: requestPayload.status,
    requestPath: toPosixPath(path.relative(wikiRoot, requestPath)),
    blockers,
  }
}

export async function approveKnowledgePromotionRequest(
  workspaceRoot: string,
  input: {
    requestId: string
    justification?: string | null
  },
  context: KnowledgePromotionContext = {},
): Promise<KnowledgePromotionApproval> {
  const requestId = input.requestId.trim()
  if (!/^kpr_[a-f0-9]{24}$/.test(requestId)) {
    throw new Error('requestId is invalid')
  }
  const wikiRoot = path.join(
    path.resolve(workspaceRoot),
    WORKSPACE_WIKI_DIRNAME,
  )
  const requestPath = ensureInsideRoot(
    path.resolve(workspaceRoot),
    path.join(wikiRoot, PROMOTION_REQUEST_DIR, `${requestId}.json`),
  )
  const requestRaw = await fs.readFile(requestPath, 'utf-8')
  const requestPayload = JSON.parse(requestRaw) as {
    request_id?: string
    blockers?: Array<string>
    requested_target?: {
      semantic_tier?: PromotionTargetAuthorityLevel
      authority_domain?: string
      tag_authority_level?: string
      source_type?: string
      authority_origin?: string
    }
    source_page?: {
      path?: string
      title?: string
      content_hash?: string
      authority_level?: string | null
      authority_use?: string | null
    }
    source_registration?: {
      source_uri?: string | null
      jurisdiction?: string | null
      effective_from?: string | null
      source_version?: string | null
      source_upload_ref?: string | null
      normalized_artifact_ref?: string | null
      parser_method?: string | null
    }
  }
  if (requestPayload.request_id !== requestId) {
    throw new Error('promotion request id mismatch')
  }

  const approvedAt = new Date().toISOString()
  const approvedBy = context.userId || 'knowledge-ui-demo'
  const approvalPayload = {
    schema_version: 'knowledge_promotion_approval.v1',
    request_id: requestId,
    status: 'APPROVED',
    approved_at: approvedAt,
    approved_by: approvedBy,
    workspace_id: context.workspaceId || null,
    demo_mode: true,
    role_gate_enforced: false,
    activation_performed: false,
    blockers_acknowledged: requestPayload.blockers || [],
    requested_target: requestPayload.requested_target || null,
    source_page: requestPayload.source_page || null,
    justification: input.justification?.trim() || 'Demo approval',
  }
  const approvalId = `kpa_${hashObject(approvalPayload).slice(0, 24)}`
  const approvalDir = ensureInsideRoot(
    path.resolve(workspaceRoot),
    path.join(wikiRoot, PROMOTION_APPROVAL_DIR),
  )
  const approvalPath = path.join(approvalDir, `${approvalId}.json`)
  const approvalPathRelative = toPosixPath(
    path.relative(wikiRoot, approvalPath),
  )
  const approvalHash = contentHash(
    JSON.stringify({ approval_id: approvalId, ...approvalPayload }),
  )
  const target = requestPayload.requested_target || {}
  const sourcePage = requestPayload.source_page || {}
  const sourceRegistration = requestPayload.source_registration || {}
  const approvedArtifact: KnowledgePromotionApprovedArtifact = {
    artifact_id: `demo_${approvalId}`,
    source_ref: sourcePage.path || requestId,
    semantic_tier: target.semantic_tier || 'T3',
    authority_domain: target.authority_domain || 'compliance',
    tag_authority_level: target.tag_authority_level || 'operational',
    source_type: target.source_type || 'field_guide',
    authority_origin: target.authority_origin || 'internal_governance',
    ingestion_status: 'DEMO_APPROVED',
    effective_from: sourceRegistration.effective_from || null,
    source_version: sourceRegistration.source_version || null,
    extraction_method: sourceRegistration.parser_method || null,
    curator: approvedBy,
    claim_count: 1,
    ambiguities: requestPayload.blockers || [],
    evidence_chain: [
      {
        stage: 'curation_upload',
        ref: sourceRegistration.source_upload_ref || sourcePage.path || null,
        hash: sourcePage.content_hash || null,
      },
      {
        stage: 'normalized_artifact',
        ref: sourceRegistration.normalized_artifact_ref || null,
        hash: sourcePage.content_hash || null,
      },
      {
        stage: 'promotion_request',
        ref: toPosixPath(path.relative(wikiRoot, requestPath)),
        hash: contentHash(requestRaw),
      },
      {
        stage: 'demo_approval',
        ref: approvalPathRelative,
        hash: approvalHash,
      },
    ],
  }
  await fs.mkdir(approvalDir, { recursive: true })
  await fs
    .writeFile(
      approvalPath,
      `${JSON.stringify(
        {
          approval_id: approvalId,
          ...approvalPayload,
          approved_artifact: approvedArtifact,
        },
        null,
        2,
      )}\n`,
      {
        encoding: 'utf-8',
        flag: 'wx',
      },
    )
    .catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    })

  return {
    ok: true,
    requestId,
    approvalId,
    status: 'APPROVED',
    approvalPath: approvalPathRelative,
    approvedArtifact,
  }
}
