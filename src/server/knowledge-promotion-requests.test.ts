import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  approveKnowledgePromotionRequest,
  createKnowledgePromotionRequest,
} from './knowledge-promotion-requests'

describe('knowledge promotion requests', () => {
  const createdRoots: Array<string> = []

  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('captures a pending governed promotion request without activating authority', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-promo-'))
    createdRoots.push(workspace)
    const knowledgeRoot = path.join(workspace, 'wiki', 'raw')
    fs.mkdirSync(knowledgeRoot, { recursive: true })
    fs.writeFileSync(
      path.join(knowledgeRoot, 'law.md'),
      [
        '# 中华人民共和国招标投标法.pdf',
        '',
        '> Curation material only. Governed promotion is required before authority use.',
        '> Authority level: curation_only',
        '> Authority use: prohibited_until_governed_promotion',
        '> Source upload ref: knowledge-upload:v1:test',
        '> Normalized artifact ref: artifacts/document_extraction/ef698189d9f9.json',
        '> Parser method: pdf_unextractable',
        '> Human curation justification: it is a law',
      ].join('\n'),
      'utf-8',
    )

    const result = await createKnowledgePromotionRequest(workspace, {
      pagePath: 'raw/law.md',
      targetAuthorityLevel: 'T2',
      justification: 'Promote as law after official text verification.',
      jurisdiction: 'CN',
    })

    expect(result.status).toBe('NEEDS_SOURCE_REGISTRATION')
    expect(result.blockers).toContain('official_source_uri_required')
    expect(result.requestPath).toMatch(
      /^\.governance\/promotion-requests\/kpr_[a-f0-9]+\.json$/,
    )
    const request = JSON.parse(
      fs.readFileSync(
        path.join(workspace, 'wiki', result.requestPath),
        'utf-8',
      ),
    )
    expect(request.status).toBe('NEEDS_SOURCE_REGISTRATION')
    expect(request.requested_target.semantic_tier).toBe('T2')
    expect(request.source_page.authority_use).toBe(
      'prohibited_until_governed_promotion',
    )
    expect(request.source_registration.normalized_artifact_ref).toBe(
      'artifacts/document_extraction/ef698189d9f9.json',
    )

    const approval = await approveKnowledgePromotionRequest(workspace, {
      requestId: result.requestId,
      justification: 'Demo approval for walkthrough.',
    })

    expect(approval.status).toBe('APPROVED')
    expect(approval.approvedArtifact.semantic_tier).toBe('T2')
    expect(approval.approvedArtifact.ingestion_status).toBe('DEMO_APPROVED')
    expect(
      approval.approvedArtifact.evidence_chain.map((step) => step.stage),
    ).toEqual([
      'curation_upload',
      'normalized_artifact',
      'promotion_request',
      'demo_approval',
    ])
    expect(approval.approvalPath).toMatch(
      /^\.governance\/promotion-approvals\/kpa_[a-f0-9]+\.json$/,
    )
    const approvalRecord = JSON.parse(
      fs.readFileSync(
        path.join(workspace, 'wiki', approval.approvalPath),
        'utf-8',
      ),
    )
    expect(approvalRecord.demo_mode).toBe(true)
    expect(approvalRecord.role_gate_enforced).toBe(false)
    expect(approvalRecord.activation_performed).toBe(false)
    expect(approvalRecord.request_id).toBe(result.requestId)
    expect(approvalRecord.approved_artifact.semantic_tier).toBe('T2')
    expect(approvalRecord.approved_artifact.source_ref).toBe('raw/law.md')
    expect(
      approvalRecord.approved_artifact.evidence_chain.some(
        (step: { stage?: string; ref?: string }) =>
          step.stage === 'demo_approval' && step.ref === approval.approvalPath,
      ),
    ).toBe(true)
  })
})
