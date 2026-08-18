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

  await page.goto('/contextgraph-studio')
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
  await page.reload()

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
    `/api/semantier-proxy/api/knowledge/builder/assertion-candidates?extractionRunId=${encodeURIComponent(extractionRunId)}&limit=500`,
  )
  expect(candidatesResponse.ok(), await candidatesResponse.text()).toBeTruthy()
  const candidatesPayload = await candidatesResponse.json() as Record<string, any>
  const extractedCandidates = candidatesPayload.assertionCandidates ?? []
  expect(extractedCandidates.length).toBeGreaterThan(100)
  const extractedTerms = extractedCandidates.map((candidate: any) =>
    candidate.normalized_assertion?.subject?.text
      ?? candidate.normalized_assertion?.object?.text
      ?? candidate.normalized_assertion?.predicate,
  )
  expect(extractedTerms).toContain('央企')
  expect(extractedTerms).toContain('本地企业')
  expect(extractedTerms).toContain('DeepSeek')
  await expect(modeNavigation.getByRole('tab', { name: /^Extract$/i })).toHaveAttribute('aria-selected', 'true')
  await expectCurrentLineageStep('Extract')
  await expect(page.getByRole('button', { name: /^AI Ground$/i })).toBeEnabled()
  const aiGroundingResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/ai-grounding-suggestions') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^AI Ground$/i }).click()
  const aiGroundingResponse = await aiGroundingResponsePromise
  expect(aiGroundingResponse.ok(), await aiGroundingResponse.text()).toBeTruthy()
  const aiGroundingPayload = await aiGroundingResponse.json() as Record<string, any>
  expect(aiGroundingPayload.authorityState).toBe('candidate_only')
  expect(aiGroundingPayload.assessmentSource).toBe('llm_structured')
  expect(aiGroundingPayload.summary?.total).toBe(extractedCandidates.length)
  expect(String(aiGroundingPayload.aiGroundingRun?.provider ?? '')).toBeTruthy()
  expect(String(aiGroundingPayload.aiGroundingRun?.model ?? '')).toBeTruthy()
  await expect(modeNavigation.getByRole('tab', { name: /^Ground$/i })).toHaveAttribute('aria-selected', 'true')
  await expectCurrentLineageStep('Ground')
  await expect(page.getByText(/Human Grounding/i)).toBeVisible()
  await expect(page.getByText(/supported|unsupported|ambiguous|needs edit|provider error/i).first()).toBeVisible()
  const batchResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/batch-grounding-events') && response.request().method() === 'POST',
  )
  await page.getByRole('checkbox', { name: /Select /i }).nth(1).click()
  await page.getByRole('button', { name: /^Batch Accept$/i }).click()
  await page.getByRole('button', { name: /^Confirm Accept$/i }).click()
  const batchResponse = await batchResponsePromise
  expect(batchResponse.ok(), await batchResponse.text()).toBeTruthy()
  expect((await batchResponse.json() as Record<string, any>).authorityState).toBe('human_grounded_not_released')
  const releaseResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/release') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Accept$/i }).click()
  const releaseResponse = await releaseResponsePromise
  expect(releaseResponse.ok(), await releaseResponse.text()).toBeTruthy()
  const releasePayload = await releaseResponse.json() as Record<string, any>
  await expect(page.getByTestId('ground-accepted-release')).toBeVisible()

  const activationResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/project-activate') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Activate release$/i }).click()
  const activationResponse = await activationResponsePromise
  expect(activationResponse.ok(), await activationResponse.text()).toBeTruthy()
  const activationPayload = await activationResponse.json() as Record<string, any>
  await expect(page.getByTestId('ground-activation-snapshot')).toBeVisible()

  const baseGraphVersion = String(releasePayload.graphRelease?.parent_graph_version ?? '')
  const releasedGraphVersion = String(releasePayload.graphRelease?.graph_version ?? '')
  expect(baseGraphVersion).toBeTruthy()
  expect(releasedGraphVersion).toBeTruthy()
  expect(releasedGraphVersion).not.toBe(baseGraphVersion)

  const discoveryRunId = String(extractionPayload.extractionRun?.discovery_run_id ?? '')
  expect(discoveryRunId).toBeTruthy()
  const evaluationDatasetResponse = await page.request.post(
    '/api/semantier-proxy/api/knowledge/builder/evaluation-datasets',
    { data: { discoveryRunId, useTenderUatFixture: true } },
  )
  expect(evaluationDatasetResponse.ok(), await evaluationDatasetResponse.text()).toBeTruthy()
  const evaluationDataset = (await evaluationDatasetResponse.json() as Record<string, any>).evaluationDataset
  const createEvaluationRun = async () => {
    const response = await page.request.post(
      '/api/semantier-proxy/api/knowledge/builder/evaluation-runs',
      { data: { evaluationDatasetId: evaluationDataset.evaluation_dataset_id, discoveryRunId } },
    )
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json() as Record<string, any>).evaluationRun
  }
  const v0EvaluationRun = await createEvaluationRun()
  const v1EvaluationRun = await createEvaluationRun()

  for (const mode of ['Graph', 'Inspect']) {
    const modeTab = modeNavigation.getByRole('tab', { name: new RegExp(`^${mode}$`, 'i') })
    await modeTab.click()
    await expect(modeTab).toHaveAttribute('aria-selected', 'true')
    await expectCurrentLineageStep(mode)
  }

  await page.getByPlaceholder('artifacts/document_extraction/target.json').fill(uploadedFileRef)
  const inspectResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/tender-document-review') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /^Run inspection$/i }).click()
  const inspectResponse = await inspectResponsePromise
  expect(inspectResponse.ok(), await inspectResponse.text()).toBeTruthy()
  const inspectPayload = await inspectResponse.json() as Record<string, any>
  expect(inspectPayload.run?.activation_set_snapshot_id).toBe(
    activationPayload.projection?.snapshot?.activation_set_snapshot_id,
  )
  expect(inspectPayload.run?.findings?.length).toBeGreaterThan(0)
  await expect(page.getByText(/Findings \([1-9]/)).toBeVisible()

  for (const mode of ['Compare', 'Evaluate']) {
    const modeTab = modeNavigation.getByRole('tab', { name: new RegExp(`^${mode}$`, 'i') })
    await modeTab.click()
    await expect(modeTab).toHaveAttribute('aria-selected', 'true')
    await expectCurrentLineageStep(mode)
  }

  await modeNavigation.getByRole('tab', { name: /^Compare$/i }).click()
  await expect(page.getByLabel('Base graph version')).toBeVisible()
  await expect(page.getByLabel('New graph version')).toBeVisible()
  await page.getByLabel('Base graph version').fill(baseGraphVersion)
  await page.getByLabel('New graph version').fill(releasedGraphVersion)
  const compareResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/compare?') && response.request().method() === 'GET',
  )
  await page.locator('section').getByRole('button', { name: /^Compare$/i }).click()
  const compareResponse = await compareResponsePromise
  expect(compareResponse.ok(), await compareResponse.text()).toBeTruthy()
  await expect(page.getByText(/Diff loaded/i)).toBeVisible()
  await modeNavigation.getByRole('tab', { name: /^Evaluate$/i }).click()
  await expect(page.getByLabel('V0 evaluation run')).toBeVisible()
  await expect(page.getByLabel('V1 evaluation run')).toBeVisible()
  await page.getByLabel('V0 evaluation run').fill(String(v0EvaluationRun.evaluation_run_id))
  await page.getByLabel('V1 evaluation run').fill(String(v1EvaluationRun.evaluation_run_id))
  const learningGateResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/contextgraph/evaluation/learning-gate') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: /Run learning gate/i }).click()
  const learningGateResponse = await learningGateResponsePromise
  expect(learningGateResponse.ok(), await learningGateResponse.text()).toBeTruthy()
  await expect(page.getByText(/STOP_REVISE|GO|SPLIT_FIX/).first()).toBeVisible()
  expect(releasePayload.graphRelease?.graph_version).toBeTruthy()
  expect(activationPayload.projection?.snapshot?.activation_set_snapshot_id).toBeTruthy()
  expect(serverFailures, serverFailures.join('\n')).toEqual([])
})
