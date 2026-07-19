import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createKnowledgePromotionRequest } from './knowledge-promotion-requests'

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
  })
})
