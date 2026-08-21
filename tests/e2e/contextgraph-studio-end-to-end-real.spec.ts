import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'


test.setTimeout(240_000)

type IdentityFixture = {
  fixtureToken: string
  login: string
  password: string
  userId: string
  organizationId: string
  workspaceId: string
  workspaceSlug: string
}

const repositoryRoot = join(process.cwd(), '..')
const fixtureScript = join(repositoryRoot, 'tests', 'fixtures', 'contextgraph_e2e_identity.py')
const fixturePython = join(repositoryRoot, '.venv', 'bin', 'python')
const fixtureAuthDb = process.env.SEMANTIER_AUTH_DB_PATH
  ?? join(process.env.F10_ROOT ?? repositoryRoot, 'auth.db')
const workspacePassword = process.env.F10_ROOT
  ? (JSON.parse(readFileSync(join(process.env.F10_ROOT, 'credentials.json'), 'utf8')) as { password: string }).password
  : null
let identityFixture: IdentityFixture | null = null

test.beforeAll(() => {
  identityFixture = JSON.parse(execFileSync(fixturePython, [
    fixtureScript, '--auth-db-path', fixtureAuthDb, 'provision',
  ], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })) as IdentityFixture
})

test.afterAll(() => {
  if (!identityFixture) return
  execFileSync(fixturePython, [
    fixtureScript,
    '--auth-db-path', fixtureAuthDb,
    'teardown',
    '--fixture-token', identityFixture.fixtureToken,
    '--user-id', identityFixture.userId,
    '--organization-id', identityFixture.organizationId,
  ], { cwd: repositoryRoot, stdio: 'pipe' })
})

test('authenticated ContextGraph Studio exposes the real seven-screen MVL', async ({ page }) => {
  expect(identityFixture).not.toBeNull()
  const credentials = identityFixture as IdentityFixture
  const sourcePath = process.env.CONTEXTGRAPH_E2E_SOURCE_DOCX
    ?? join(process.cwd(), '..', 'docs', '招投标法规', 'POC测试敏感词汇总.docx')
  const serverFailures: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 500) {
      serverFailures.push(`${response.status()} ${response.url()}`)
    }
  })

  await page.goto('/contextgraph-studio', {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  })
  const gatewayLogin = await page.request.post(
    `${process.env.HERMES_API_URL ?? ''}/auth/password/login`, {
    data: { login: credentials.login, password: credentials.password },
    },
  )
  expect(gatewayLogin.ok(), await gatewayLogin.text()).toBeTruthy()
  const workspaceLogin = await page.request.post('/api/auth', {
    data: { password: workspacePassword ?? credentials.password },
  })
  expect(workspaceLogin.ok() || workspaceLogin.status() === 400, await workspaceLogin.text()).toBeTruthy()
  await page.reload({ waitUntil: 'commit' })

  await expect(page.getByRole('heading', { name: /ContextGraph Studio/i })).toBeVisible()
  const uploadResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/knowledge/upload') && response.request().method() === 'POST',
  )
  const ingestResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/knowledge/ingest') && response.request().method() === 'POST',
  )
  await page.getByTestId('source-file-input').setInputFiles(sourcePath)
  const uploadResponse = await uploadResponsePromise
  expect(uploadResponse.ok(), await uploadResponse.text()).toBeTruthy()
  const uploadResults = await uploadResponse.json() as Array<Record<string, unknown>>
  expect(Array.isArray(uploadResults)).toBeTruthy()
  expect(uploadResults.some((result) => result.ok === true)).toBeTruthy()
  const uploadedName = String(uploadResults.find((result) => result.ok)?.storedName
    ?? uploadResults.find((result) => result.ok)?.originalName)
  const ingestResponse = await ingestResponsePromise
  expect(ingestResponse.ok(), await ingestResponse.text()).toBeTruthy()
  const ingestPayload = await ingestResponse.json() as Record<string, unknown>
  const uploadedFileRef = String(ingestPayload.normalizedDocumentArtifactRef ?? '')
  expect(uploadedFileRef).toBeTruthy()
  const normalizedSourceName = uploadedName.replace(/\.(docx?|pdf|md)$/i, '.md')
  await expect(page.getByText(uploadedName, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(normalizedSourceName, { exact: true })).toBeVisible()
  await expect(page.getByText('Internal normalized representation')).toBeVisible()
  await page.getByRole('button', { name: normalizedSourceName, exact: true }).click()
  const sourceInspector = page.getByTestId('contextgraph-studio-inspector')
  await expect(sourceInspector.getByText('Metadata context')).toBeVisible()
  await expect(sourceInspector.getByText('Context lineage')).toBeVisible()
  await expect(sourceInspector.getByText('Document normalization')).toBeVisible()
  await expect(sourceInspector.getByText('Context added by this step').first()).toBeVisible()
  await expect(sourceInspector.getByText('docx_ooxml', { exact: true })).toBeVisible()
  const expectCurrentLineageStep = async (label: string) => {
    const step = sourceInspector
      .getByRole('listitem')
      .filter({ hasText: label })
    await expect(step.getByText('Current step')).toBeVisible()
  }

  const modeNavigation = page.getByRole('navigation', { name: 'ContextGraph Studio modes' })
  await page.getByLabel(`Select ${normalizedSourceName}`).check()
  const extractionResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/knowledge/builder/extraction-runs')
      && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Batch extract$/i }).click()
  const extractionResponse = await extractionResponsePromise
  expect(extractionResponse.ok(), await extractionResponse.text()).toBeTruthy()
  const extractionPayload = await extractionResponse.json() as Record<string, any>
  expect(extractionPayload.extractionRun?.run_status).toBe('completed')
  const extractionRunId = String(extractionPayload.extractionRun?.extraction_run_id ?? '')
  expect(extractionRunId).toBeTruthy()
  const candidatesResponse = await page.request.get(
    `/api/semantier-proxy/api/knowledge/builder/reference-concepts?extractionRunId=${encodeURIComponent(extractionRunId)}&limit=500`,
  )
  expect(candidatesResponse.ok(), await candidatesResponse.text()).toBeTruthy()
  const candidatesPayload = await candidatesResponse.json() as Record<string, any>
  const extractedCandidates = candidatesPayload.assertionCandidates ?? []
  expect(extractedCandidates.length).toBeGreaterThan(0)
  expect(candidatesPayload.referenceConcepts?.length ?? 0).toBe(extractedCandidates.length)
  const firstCandidateLabel = String(
    extractedCandidates[0]?.normalized_assertion?.subject?.text
      ?? extractedCandidates[0]?.normalized_assertion?.object?.text
      ?? extractedCandidates[0]?.assertion_id
      ?? '',
  )
  expect(firstCandidateLabel).toBeTruthy()
  const legacyCandidatesResponse = await page.request.get(
    `/api/semantier-proxy/api/knowledge/builder/assertion-candidates?extractionRunId=${encodeURIComponent(extractionRunId)}&limit=500`,
  )
  expect(legacyCandidatesResponse.ok(), await legacyCandidatesResponse.text()).toBeTruthy()
  const legacyCandidatesPayload = await legacyCandidatesResponse.json() as Record<string, any>
  expect(legacyCandidatesPayload.assertionCandidates ?? []).toEqual([])
  await expect(modeNavigation.getByRole('tab', { name: /^Extract$/i })).toHaveAttribute('aria-selected', 'true')
  await expectCurrentLineageStep('Extract')
  await expect(page.getByText(/Reference concepts/i).first()).toBeVisible()
  await expect(page.getByText(/Canonical expressions/i).first()).toBeVisible()
  await expect(page.getByText(firstCandidateLabel, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: /^AI Ground$/i })).toBeVisible()
  const aiGroundResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/knowledge/builder/extraction-runs/${extractionRunId}/ai-grounding-suggestions`)
      && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^AI Ground$/i }).click()
  const aiGroundResponse = await aiGroundResponsePromise
  expect(aiGroundResponse.ok(), await aiGroundResponse.text()).toBeTruthy()
  const aiGroundPayload = await aiGroundResponse.json() as Record<string, any>
  expect(aiGroundPayload.authorityState).toBe('candidate_only')
  expect(aiGroundPayload.suggestions?.length ?? 0).toBeGreaterThan(0)

  const groundTab = modeNavigation.getByRole('tab', { name: /^Ground$/i })
  await groundTab.click()
  await expect(groundTab).toHaveAttribute('aria-selected', 'true')
  await expectCurrentLineageStep('Ground')
  await expect(page.getByText(/supported/i).first()).toBeVisible()

  await page.getByLabel('Select all candidates on this page').check()
  await expect(page.getByRole('button', { name: /^Batch Accept$/i })).toBeVisible()
  await page.getByRole('button', { name: /^Batch Accept$/i }).click()
  const batchResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/knowledge/builder/reference-concepts/batch-grounding-events')
      && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Confirm Accept$/i }).click()
  const batchResponse = await batchResponsePromise
  expect(batchResponse.ok(), await batchResponse.text()).toBeTruthy()
  const batchPayload = await batchResponse.json() as Record<string, any>
  expect(batchPayload.authorityState).toBe('accepted_graph_released')

  const releaseResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/knowledge/builder/reference-concepts/')
      && response.url().endsWith('/release')
      && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Accept$/i }).click()
  const releaseResponse = await releaseResponsePromise
  expect(releaseResponse.ok(), await releaseResponse.text()).toBeTruthy()
  const releasePayload = await releaseResponse.json() as Record<string, any>
  expect(releasePayload.graphRelease?.graph_version).toBeTruthy()
  await expect(page.getByTestId('ground-accepted-release')).toBeVisible()
  const activateResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/knowledge/builder/graph-releases/${releasePayload.graphRelease.graph_version}/project-activate`)
      && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Activate release$/i }).click()
  const activateResponse = await activateResponsePromise
  expect(activateResponse.ok(), await activateResponse.text()).toBeTruthy()
  await expect(page.getByTestId('ground-activation-snapshot')).toBeVisible()

  for (const mode of ['Graph', 'Inspect', 'Compare', 'Evaluate']) {
    const modeTab = modeNavigation.getByRole('tab', { name: new RegExp(`^${mode}$`, 'i') })
    await modeTab.click()
    await expect(modeTab).toHaveAttribute('aria-selected', 'true')
    await expectCurrentLineageStep(mode)
  }

  await modeNavigation.getByRole('tab', { name: /^Inspect$/i }).click()
  await page.getByPlaceholder('artifacts/document_extraction/target.json').fill(uploadedFileRef)
  await expect(page.getByRole('button', { name: /^Run inspection$/i })).toBeVisible()

  await modeNavigation.getByRole('tab', { name: /^Compare$/i }).click()
  await expect(page.getByLabel('Base graph version')).toBeVisible()
  await expect(page.getByLabel('New graph version')).toBeVisible()

  await modeNavigation.getByRole('tab', { name: /^Evaluate$/i }).click()
  await expect(page.getByLabel('V0 evaluation run')).toBeVisible()
  await expect(page.getByLabel('V1 evaluation run')).toBeVisible()
  expect(serverFailures, serverFailures.join('\n')).toEqual([])
})
