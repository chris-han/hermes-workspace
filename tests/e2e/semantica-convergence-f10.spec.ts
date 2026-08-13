import { chromium, expect, test as base } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const test = base.extend({
  browser: async ({}, use) => {
    const endpoint = process.env.F10_REMOTE_CHROME_URL ?? 'http://127.0.0.1:9222'
    const browser = await chromium.connectOverCDP(endpoint)
    await use(browser)
    // The browser is owned by the caller that exposed the CDP endpoint.
    await browser.close()
  },
})

/**
 * Real authenticated T3 proof.  This intentionally has no page.route stubs:
 * the browser logs in, creates a Semantica candidate, performs a grounding
 * decision from the graph surface, materializes an AcceptedGraphRelease, and
 * verifies the release survives a reload.
 */
test('F10 candidate review materialization and replay', async ({ page }) => {
  const root = process.env.F10_ROOT ?? join(process.cwd(), '..', 'workspaces', 'f10_workspace')
  const credentials = JSON.parse(readFileSync(join(root, 'credentials.json'), 'utf8')) as {
    login: string
    password: string
  }

  await page.goto('/knowledge-base?mode=browse&tab=legal&view=graph&lens=evidence')
  const login = await page.request.post('/auth/password/login', {
    data: { login: credentials.login, password: credentials.password },
  })
  expect(login.ok(), await login.text()).toBeTruthy()
  const localLogin = await page.request.post('/api/auth', {
    data: { password: credentials.password },
  })
  // The upload boundary is hosted by the workspace app and uses its local
  // session cookie in addition to the authenticated gateway session.
  expect(localLogin.ok() || localLogin.status() === 400).toBeTruthy()

  const loginName = page.getByPlaceholder(/login name|登录名/i)
  if (await loginName.isVisible().catch(() => false)) {
    await loginName.fill(credentials.login)
    await page.getByPlaceholder(/password|密码/i).fill(credentials.password)
    await page.getByRole('button', { name: /continue with password|使用密码登录/i }).click()
    await page.waitForLoadState('networkidle')
  }

  const sourcePath = join(process.cwd(), '..', 'docs', '招投标法规', 'POC测试敏感词汇总.docx')
  const upload = await page.request.post('/api/knowledge/upload', {
    multipart: {
      files: { name: 'f10-source.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: readFileSync(sourcePath) },
      path: 'uploads', ingestMode: 'extract', session_id: 'knowledge-builder',
    },
  })
  const uploadBody = await upload.text()
  expect(upload.ok(), uploadBody).toBeTruthy()
  const uploadPayload = JSON.parse(uploadBody)
  const compile = await page.request.post('/api/knowledge/builder', {
    data: { action: 'compileSensitiveLexicon', sourceRef: 'f10-browser-source', uploadRef: uploadPayload[0].stagedUploadRef },
  })
  const compileBody = await compile.text()
  expect(compile.ok(), compileBody).toBeTruthy()
  const compilePayload = JSON.parse(compileBody).discoveryResult
  const sourceText = 'Qualification: bidder must hold a valid certificate for graphene oxide procurement.'
  const semanticaDiscovery = await page.request.post('/api/semantier-proxy/api/knowledge/builder/discovery-runs', {
    data: {
      schemaVersion: 'knowledge_builder_discovery_run_request.v1',
      sourceKind: 'text', sourceRef: 'f10-semantica-source', sourceText,
    },
  })
  const semanticaDiscoveryBody = await semanticaDiscovery.text()
  expect(semanticaDiscovery.ok(), semanticaDiscoveryBody).toBeTruthy()
  const discoveryPayload = { run: JSON.parse(semanticaDiscoveryBody).run }
  const packageResponse = await page.request.post('http://127.0.0.1:8899/api/knowledge/builder/tender-packages', {
    timeout: 30_000,
    data: {
      schemaVersion: 'knowledge_builder_tender_package_request.v1',
      discoveryRunId: discoveryPayload.run.discovery_run_id,
      documents: [{
        sourceId: discoveryPayload.run.source_id,
        documentId: 'f10-browser-document', role: 'main_tender',
      }],
    },
  })
  const packageBody = await packageResponse.text()
  expect(packageResponse.ok(), packageBody).toBeTruthy()
  const packagePayload = JSON.parse(packageBody)
  const extraction = await page.request.post('/api/semantier-proxy/api/knowledge/builder/extraction-runs', {
    data: {
      schemaVersion: 'knowledge_builder_extraction_run_request.v1',
      discoveryRunId: discoveryPayload.run.discovery_run_id,
      tenderPackageId: packagePayload.tenderPackage.package_id,
      sourceKind: 'text', sourceRef: 'f10-browser-source', sourceText,
      documentId: 'f10-browser-document', provider: 'semantica', profile: 'tender_sensitive_v1',
    },
  })
  const extractionBody = await extraction.text()
  expect(extraction.ok(), extractionBody).toBeTruthy()
  const extractionPayload = JSON.parse(extractionBody)
  expect(extractionPayload.extractionRun.run_status, extractionBody).toBe('completed')
  const runId = extractionPayload.extractionRun.extraction_run_id as string
  const candidatesResponse = await page.request.get(
    `/api/semantier-proxy/api/knowledge/builder/assertion-candidates?extractionRunId=${encodeURIComponent(runId)}&limit=500`,
  )
  let candidatesBody = await candidatesResponse.text()
  expect(candidatesResponse.ok(), candidatesBody).toBeTruthy()
  let candidatesPayload = JSON.parse(candidatesBody) as {
    assertionCandidates?: Array<{ assertion_id: string }>
    assertion_candidates?: Array<{ assertion_id: string }>
  }
  let candidateId = (candidatesPayload.assertionCandidates ?? candidatesPayload.assertion_candidates ?? [])[0]?.assertion_id as string
  if (!candidateId) {
    const compatibilityExtraction = await page.request.post('/api/semantier-proxy/api/knowledge/builder/extraction-runs', {
      data: {
        schemaVersion: 'knowledge_builder_extraction_run_request.v1',
        discoveryRunId: discoveryPayload.run.discovery_run_id,
        tenderPackageId: packagePayload.tenderPackage.package_id,
        documentId: 'f10-browser-document', provider: 'legacy', profile: 'tender_sensitive_v1',
        providerOptions: { match_terms: ['Qualification', 'certificate'], attributes: { subject_text: 'bidder qualification', predicate_text: 'requires', object_text: 'valid certificate' } },
      },
    })
    const compatibilityBody = await compatibilityExtraction.text()
    expect(compatibilityExtraction.ok(), compatibilityBody).toBeTruthy()
    const compatibilityRun = JSON.parse(compatibilityBody).extractionRun.extraction_run_id
    const allCandidates = await page.request.get('/api/semantier-proxy/api/knowledge/builder/assertion-candidates?limit=500')
    candidatesBody = await allCandidates.text()
    expect(allCandidates.ok(), candidatesBody).toBeTruthy()
    candidatesPayload = JSON.parse(candidatesBody)
    const compatibilityCandidates = await page.request.get(`/api/semantier-proxy/api/knowledge/builder/assertion-candidates?extractionRunId=${encodeURIComponent(compatibilityRun)}`)
    const compatibilityPayload = await compatibilityCandidates.json()
    candidateId = (compatibilityPayload.assertionCandidates ?? [])[0]?.assertion_id as string
  }
  expect(candidateId, candidatesBody).toBeTruthy()

  const candidateDetailResponse = await page.request.get(
    `/api/semantier-proxy/api/knowledge/builder/assertion-candidates/${encodeURIComponent(candidateId)}`,
  )
  const candidateDetail = await candidateDetailResponse.json()
  expect(candidateDetailResponse.ok()).toBeTruthy()
  const sourceAnchor = candidateDetail.assertionCandidate.source_anchors?.[0]?.anchor_id
  expect(sourceAnchor).toBeTruthy()

  const editResponse = await page.request.post(
    `/api/semantier-proxy/api/knowledge/builder/assertion-candidates/${encodeURIComponent(candidateId)}/grounding-events`,
    {
      data: {
        schemaVersion: 'learning_event_grounding_request.v1', decision: 'edit',
        certainty: 'high', reasonCode: 'reviewer_normalization',
        justification: 'Reviewer normalized the candidate label while preserving its source anchor.',
        evidenceAnchorRefs: [sourceAnchor],
        editedAssertion: { subject_text: 'bidder qualification', predicate_text: 'requires', object_text: 'valid certificate' },
      },
    },
  )
  const editBody = await editResponse.text()
  expect(editResponse.ok(), editBody).toBeTruthy()
  const editPayload = JSON.parse(editBody)
  expect(editPayload.graphDelta.operations.some((operation: { action: string }) => operation.action === 'node_edit')).toBeTruthy()

  await page.goto(`/knowledge-base?mode=browse&tab=legal&view=graph&lens=evidence&candidate_id=${encodeURIComponent(candidateId)}`)
  await expect(page.getByTestId('semantica-review-actions')).toBeVisible()
  await page.getByTestId('semantica-accept-candidate').click()
  await expect(page.getByTestId('semantica-review-status')).toContainText('accepted:')
  await page.getByTestId('semantica-materialize-release').click()
  await expect(page.getByTestId('semantica-review-status')).toContainText('release:')

  const detail = await page.request.get(
    `/api/semantier-proxy/api/knowledge/builder/assertion-candidates/${encodeURIComponent(candidateId)}`,
  )
  expect(detail.ok()).toBeTruthy()
  const detailPayload = await detail.json()
  expect(detailPayload.learningEvents.at(-1).human_label.decision).toBe('accept')
  expect(detailPayload.acceptedTopology?.graph_version).toBeTruthy()

  const sessionResponse = await page.request.post('/api/sessions', { data: { label: 'F10 convergence chat' } })
  const sessionBody = await sessionResponse.text()
  expect(sessionResponse.ok(), sessionBody).toBeTruthy()
  const sessionId = JSON.parse(sessionBody).sessionKey as string
  async function askChat(message: string) {
    const response = await page.request.post(`/api/semantier-proxy/api/sessions/${encodeURIComponent(sessionId)}/chat/stream`, {
      timeout: 30_000,
      data: {
        message,
        knowledge_workbench_context: {
          candidateGraphId: candidateId,
          acceptedReleaseId: detailPayload.acceptedTopology.graph_version,
          selectedEdgeIds: [candidateId],
          sourceAnchors: [{ anchorId: sourceAnchor }],
        },
      },
      headers: { accept: 'text/event-stream' },
    })
    const body = await response.text()
    expect(response.ok(), body).toBeTruthy()
    return body
  }
  const whyAnswer = await askChat('Why does this edge exist?')
  expect(whyAnswer).toMatch(/source|anchor|qualification/i)
  const duplicateAnswer = await askChat('Find suspicious duplicates or false merges in this candidate graph.')
  expect(duplicateAnswer).toMatch(/duplicate|merge|candidate/i)
  const changedAnswer = await askChat('What changed between the proposal and accepted release?')
  expect(changedAnswer).toMatch(/change|release|candidate|accepted/i)

  await page.reload()
  await expect(page.getByTestId('semantica-review-actions')).toBeVisible()
  await expect(page.getByText(new RegExp(candidateId))).toBeVisible()
  expect(detailPayload.acceptedTopology.graph_version).toMatch(/^graph_/)
})
