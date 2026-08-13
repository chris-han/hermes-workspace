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

  const login = await page.request.post('/auth/password/login', {
    data: { login: credentials.login, password: credentials.password },
  })
  expect(login.ok()).toBeTruthy()

  await page.goto('/knowledge-base?mode=browse&tab=legal&view=graph&lens=evidence')
  const loginName = page.getByPlaceholder(/login name|登录名/i)
  if (await loginName.isVisible().catch(() => false)) {
    await loginName.fill(credentials.login)
    await page.getByPlaceholder(/password|密码/i).fill(credentials.password)
    await page.getByRole('button', { name: /continue with password|使用密码登录/i }).click()
    await page.waitForLoadState('networkidle')
  }

  const sourceText = 'Qualification: bidder must hold a valid certificate for graphene oxide procurement.'
  const discovery = await page.request.post('/api/semantier-proxy/api/knowledge/builder/discovery-runs', {
    data: {
      schemaVersion: 'knowledge_builder_discovery_run_request.v1',
      sourceKind: 'text', sourceRef: 'f10-browser-source', sourceText,
    },
  })
  expect(discovery.ok(), await discovery.text()).toBeTruthy()
  const discoveryPayload = await discovery.json()
  const packageResponse = await page.request.post('/api/semantier-proxy/api/knowledge/builder/tender-packages', {
    data: {
      schemaVersion: 'knowledge_builder_tender_package_request.v1',
      discoveryRunId: discoveryPayload.run.discovery_run_id,
      documents: [{
        discoveryRunId: discoveryPayload.run.discovery_run_id,
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
  const runId = extractionPayload.extractionRun.extraction_run_id as string
  const candidatesResponse = await page.request.get(
    `/api/semantier-proxy/api/knowledge/builder/assertion-candidates?extractionRunId=${encodeURIComponent(runId)}`,
  )
  const candidatesBody = await candidatesResponse.text()
  expect(candidatesResponse.ok(), candidatesBody).toBeTruthy()
  const candidatesPayload = JSON.parse(candidatesBody) as {
    assertionCandidates?: Array<{ assertion_id: string }>
    assertion_candidates?: Array<{ assertion_id: string }>
  }
  const candidateId = (candidatesPayload.assertionCandidates ?? candidatesPayload.assertion_candidates ?? [])[0]?.assertion_id as string
  expect(candidateId, candidatesBody).toBeTruthy()

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

  await page.reload()
  await expect(page.getByTestId('semantica-review-actions')).toBeVisible()
  await expect(page.getByText(new RegExp(candidateId))).toBeVisible()
})
